import { config } from '../config/environment.js'
import crypto from 'node:crypto'

function validateKey(key) {
  if (typeof key !== 'string' || !key || key.startsWith('/') || key.includes('\\') || key.split('/').some(part => !part || part === '.' || part === '..') || !/^[a-zA-Z0-9/_.-]+$/.test(key)) {
    throw new Error('Invalid storage key')
  }
  return key
}

function safeUpstreamCode(value) {
  const code = String(value ?? '')
  return /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(code) ? code : undefined
}

function safeUpstreamMessage(value, secret) {
  if (typeof value !== 'string') return undefined
  return value.slice(0, 200)
    .replaceAll(secret, '[REDACTED_SUPABASE_SECRET_KEY]')
    .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]')
    .replace(/\b(?:bearer\s+)[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/\b(?:sb_secret_|eyJ)[A-Za-z0-9._~+/=-]+/g, '[REDACTED_TOKEN]')
    .replace(/\b[a-f0-9]{64}\b/gi, '<sha256>')
}

function safeBucketName(value) {
  const bucket = String(value ?? '')
  return /^[a-z0-9][a-z0-9._-]{0,62}$/.test(bucket) ? bucket : '[invalid-bucket]'
}

function objectKeyShape(value) {
  return String(value ?? '').split('/').map(part => {
    if (/^[a-f0-9]{64}$/i.test(part)) return '<sha256>'
    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(part)) return '<uuid>'
    if (/^\d+$/.test(part)) return '<index>'
    return /^[a-zA-Z][a-zA-Z0-9_.-]{0,31}$/.test(part) ? part : '<segment>'
  }).join('/')
}

async function storageFailure(response, method, secret) {
  let payload
  try { payload = await response.json() } catch { payload = {} }
  const storageCode = safeUpstreamCode(payload.code || payload.error || payload.statusCode)
  const upstreamMessage = safeUpstreamMessage(payload.message || payload.error_description, secret)
  const operation = { POST: 'upload', GET: 'read', DELETE: 'delete' }[method] || method.toLowerCase()
  return { storageCode, upstreamMessage, operation }
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
    const headers = {
      apikey: configuration.storageKey,
      'content-type': metadata.mimeType || 'application/octet-stream',
      'x-upsert': 'false'
    }
    // Current sb_secret_ keys are API keys, not JWTs. Legacy service-role JWTs
    // still require the Bearer header during the compatibility window.
    if (!configuration.storageKey.startsWith('sb_secret_')) headers.authorization = `Bearer ${configuration.storageKey}`
    const response = await request(`${origin}/storage/v1/object/${encodeURIComponent(configuration.storageBucket)}/${validateKey(key).split('/').map(encodeURIComponent).join('/')}`, {
      method, headers, signal: AbortSignal.timeout(30000), ...(body === undefined ? {} : { body })
    })
    let failure
    if (!response.ok) failure = await storageFailure(response, method, configuration.storageKey)
    if (method !== 'POST' && (response.status === 404 || (response.status === 400 && failure?.storageCode === 'NoSuchKey'))) return null
    if (method === 'POST' && [400, 409].includes(response.status)) {
      const existing = await remote(key, 'GET')
      if (existing && Buffer.from(body).equals(existing)) return true
    }
    if (!response.ok) {
      // Storage errors can contain keys or credentials; do not propagate response bodies.
      const detail = [response.status, failure?.storageCode].filter(Boolean).join(' ')
      const error = new Error(`Object storage ${failure?.operation || 'request'} failed${detail ? ` (${detail})` : ''}`)
      error.code = 'STORAGE_UNAVAILABLE'; error.status = 503
      error.upstreamStatus = response.status
      error.storageCode = failure?.storageCode
      error.upstreamMessage = failure?.upstreamMessage
      error.operation = failure?.operation
      error.storageProvider = 'supabase'
      error.bucketName = safeBucketName(configuration.storageBucket)
      error.objectKeyShape = objectKeyShape(key)
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
