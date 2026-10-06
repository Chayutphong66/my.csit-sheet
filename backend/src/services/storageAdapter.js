import { config } from '../config/environment.js'
import crypto from 'node:crypto'

function validateKey(key) {
  if (typeof key !== 'string' || !key || key.startsWith('/') || key.includes('\\') || key.split('/').some(part => !part || part === '.' || part === '..') || !/^[a-zA-Z0-9/_.-]+$/.test(key)) {
    throw new Error('Invalid storage key')
  }
  return key
}

export function createStorageAdapter(configuration = config, request = fetch) {
  if (!['database', 'supabase', 'netlify'].includes(configuration.storageDriver)) throw new Error('Unsupported storage provider')
  let netlifyStore
  async function localDatabase() {
    const { db } = await import('../data/databaseClient.js')
    return db
  }
  function localHash(key) {
    if (!/^sha256\/[a-f0-9]{64}$/.test(key)) throw new Error('Database asset storage requires a SHA-256 key')
    return key.slice(7)
  }
  async function netlify() {
    netlifyStore ||= import('@netlify/blobs').then(({ getStore }) => getStore({ name: 'csit-sheet-files', consistency: 'strong' }))
    return netlifyStore
  }
  function supabaseConfiguration() {
    if (!configuration.storageUrl || !configuration.storageKey || !configuration.storageBucket) {
      throw new Error('Supabase storage requires SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_STORAGE_BUCKET')
    }
    const url = new URL(configuration.storageUrl)
    if (url.protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS')
    return url.origin
  }
  async function remote(key, method, body, metadata = {}) {
    const origin = supabaseConfiguration()
    const response = await request(`${origin}/storage/v1/object/${encodeURIComponent(configuration.storageBucket)}/${validateKey(key).split('/').map(encodeURIComponent).join('/')}`, {
      method, headers: {
        authorization: `Bearer ${configuration.storageKey}`, apikey: configuration.storageKey,
        'content-type': metadata.mimeType || 'application/octet-stream', 'x-upsert': 'false'
      }, signal: AbortSignal.timeout(30000), ...(body === undefined ? {} : { body })
    })
    if (response.status === 404 && method !== 'POST') return null
    if (method === 'POST' && [400, 409].includes(response.status)) {
      const existing = await remote(key, 'GET')
      if (existing && Buffer.from(body).equals(existing)) return true
    }
    if (!response.ok) {
      // Storage errors can contain keys or credentials; do not propagate response bodies.
      const error = new Error('Object storage request failed')
      error.code = 'STORAGE_UNAVAILABLE'; error.status = 503
      throw error
    }
    return method === 'GET' ? Buffer.from(await response.arrayBuffer()) : true
  }
  return {
    provider: configuration.storageDriver,
    async save(key, bytes, metadata = {}) {
      validateKey(key)
      if (configuration.storageDriver === 'supabase') return remote(key, 'POST', Buffer.from(bytes), metadata)
      if (configuration.storageDriver === 'netlify') return (await netlify()).set(key, Buffer.from(bytes), { onlyIfNew: true, metadata })
      const hash = localHash(key)
      if (crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex') !== hash) throw new Error('Asset bytes do not match the storage key')
      await (await localDatabase()).prepare(`INSERT OR IGNORE INTO file_assets
        (id,binary_hash,original_filename,mime_type,file_size,file_data) VALUES(?,?,?,?,?,?)`)
        .run(crypto.randomUUID(), hash, metadata.originalFilename || 'document', metadata.mimeType || '', bytes.length, Buffer.from(bytes))
      return key
    },
    async read(key) {
      validateKey(key)
      if (configuration.storageDriver === 'supabase') return remote(key, 'GET')
      if (configuration.storageDriver === 'netlify') {
        const data = await (await netlify()).get(key, { type: 'arrayBuffer' })
        return data ? Buffer.from(data) : null
      }
      const row = await (await localDatabase()).prepare('SELECT file_data FROM file_assets WHERE binary_hash=?').get(localHash(key))
      return row?.file_data ? Buffer.from(row.file_data) : null
    },
    async delete(key) {
      validateKey(key)
      if (configuration.storageDriver === 'supabase') return remote(key, 'DELETE')
      if (configuration.storageDriver === 'netlify') return (await netlify()).delete(key)
      const database = await localDatabase()
      // Foreign keys reject deletion of any still-referenced asset.
      await database.prepare('DELETE FROM file_assets WHERE binary_hash=?').run(localHash(key))
    },
    async exists(key) { return Boolean(await this.read(key)) },
    async metadata(key) {
      validateKey(key)
      const bytes = await this.read(key)
      if (!bytes) return null
      if (configuration.storageDriver === 'database') {
        const row = await (await localDatabase()).prepare('SELECT original_filename,mime_type FROM file_assets WHERE binary_hash=?').get(localHash(key))
        return { size: bytes.length, originalFilename: row.original_filename, mimeType: row.mime_type }
      }
      return { size: bytes.length }
    }
  }
}

export const storage = createStorageAdapter()
