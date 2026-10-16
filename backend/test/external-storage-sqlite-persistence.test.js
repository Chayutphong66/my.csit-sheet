import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const objects = new Map()
const storageServer = http.createServer(async (request, response) => {
  if (!request.headers.apikey) {
    response.writeHead(401, { 'content-type': 'application/json' }).end('{}')
    return
  }
  const key = new URL(request.url, 'http://127.0.0.1').pathname
  if (request.method === 'POST') {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    if (objects.has(key)) {
      response.writeHead(409, { 'content-type': 'application/json' }).end(JSON.stringify({ code: 'Duplicate' }))
      return
    }
    objects.set(key, Buffer.concat(chunks))
    response.writeHead(200, { 'content-type': 'application/json' }).end('{}')
    return
  }
  if (request.method === 'GET') {
    const bytes = objects.get(key)
    if (!bytes) response.writeHead(404, { 'content-type': 'application/json' }).end(JSON.stringify({ code: 'NoSuchKey' }))
    else response.writeHead(200, { 'content-type': 'application/octet-stream' }).end(bytes)
    return
  }
  if (request.method === 'DELETE') {
    objects.delete(key)
    response.writeHead(200, { 'content-type': 'application/json' }).end('{}')
    return
  }
  response.writeHead(405).end()
})
storageServer.listen(0, '127.0.0.1')
await once(storageServer, 'listening')

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'csit-external-sqlite-'))
const runId = `persistence-${process.pid}`
process.env.NODE_ENV = 'test'
process.env.DATABASE_DRIVER = 'sqlite'
process.env.DATABASE_PATH = path.join(temporaryDirectory, 'external.sqlite')
process.env.STORAGE_DRIVER = 'supabase'
process.env.EXTERNAL_STORAGE_TEST_MODE = 'local-ephemeral'
process.env.EXTERNAL_STORAGE_CREDENTIAL_SOURCE = 'supabase-local-status'
process.env.EXTERNAL_STORAGE_RUN_ID = runId
process.env.SUPABASE_URL = `http://127.0.0.1:${storageServer.address().port}`
process.env.SUPABASE_SECRET_KEY = 'local-test-secret'
process.env.SUPABASE_STORAGE_BUCKET = 'phase7b-persistence-test'
process.env.SUPABASE_STORAGE_PREFIX = `phase7b/${runId}`
process.env.JWT_SECRET = 'external-storage-sqlite-persistence-test-secret'
process.env.SKIP_DB_SEED = '1'

const database = await import('../src/data/databaseClient.js')
const { db } = database
const { createStorageAdapter } = await import('../src/services/storageAdapter.js')
const { config } = await import('../src/config/environment.js')
const adapter = createStorageAdapter(config)
const {
  deleteOrphanFileAssets, findFileAssetByHash, getOrCreateFileAsset
} = await import('../src/repositories/fileAsset.repository.js')
let applicationServer

after(async () => {
  if (applicationServer) await new Promise(resolve => applicationServer.close(resolve))
  await database.closeDatabase()
  await new Promise(resolve => storageServer.close(resolve))
  rmSync(temporaryDirectory, { recursive: true, force: true })
})

test('SQLite persists external references, deduplicates and reads intact bytes', async () => {
  const bytes = Buffer.from('external reference integrity fixture')
  const binaryHash = crypto.createHash('sha256').update(bytes).digest('hex')
  const assets = await Promise.all(Array.from({ length: 3 }, () => getOrCreateFileAsset({
    binaryHash, originalFilename: 'external.pdf', mimeType: 'application/pdf', fileData: bytes
  })))
  assert.equal(new Set(assets.map(asset => asset.id)).size, 1)
  const row = await db.prepare('SELECT file_data,blob_key FROM file_assets WHERE binary_hash=?').get(binaryHash)
  assert.equal(row.file_data, null)
  assert.equal(row.blob_key, `sha256/${binaryHash}`)
  assert.deepEqual(Buffer.from((await findFileAssetByHash(binaryHash)).fileData), bytes)
  assert.equal((await db.prepare('SELECT COUNT(*) count FROM file_assets WHERE binary_hash=?').get(binaryHash)).count, 1)
  assert.equal(await deleteOrphanFileAssets(), 1)
  await adapter.delete(`sha256/${binaryHash}`)
  assert.equal(await adapter.read(`sha256/${binaryHash}`), null)
})

test('a database constraint failure is explicit and its test-owned object can be cleaned from the manifest', async () => {
  const bytes = Buffer.from('partial persistence failure fixture')
  const binaryHash = crypto.createHash('sha256').update(bytes).digest('hex')
  const key = `sha256/${binaryHash}`
  await assert.rejects(
    getOrCreateFileAsset({ binaryHash, originalFilename: null, mimeType: 'application/pdf', fileData: bytes }),
    error => error.code === 'FILE_ASSET_PERSISTENCE_ERROR' && error.status === 500
  )
  assert.equal(await findFileAssetByHash(binaryHash), null)
  assert.deepEqual(await adapter.read(key), bytes)
  await adapter.delete(key)
  assert.equal(await adapter.read(key), null)
})

test('collection cover flow stores an external reference and preserves object integrity through database cleanup', async () => {
  const { createUser } = await import('../src/repositories/user.repository.js')
  const { hashPassword } = await import('../src/services/password.service.js')
  const { createAccessToken } = await import('../src/services/token.service.js')
  const owner = await createUser({
    id: crypto.randomUUID(), username: `external${Date.now()}`,
    email: `external-${crypto.randomUUID()}@example.invalid`, password: hashPassword('StorageFixture123'), role: 'USER'
  })
  const token = createAccessToken(owner)
  const { default: app } = await import('../src/app.js')
  applicationServer = app.listen(0, '127.0.0.1')
  await once(applicationServer, 'listening')
  const base = `http://127.0.0.1:${applicationServer.address().port}/api`
  async function api(route, { method = 'GET', body } = {}) {
    const response = await fetch(base + route, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    return { response, data: await response.json() }
  }

  const created = await api('/collections', { method: 'POST', body: { name: 'SQLite external cover', collectionType: 'MIXED' } })
  assert.equal(created.response.status, 201)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKsAAAAASUVORK5CYII=', 'base64')
  const binaryHash = crypto.createHash('sha256').update(png).digest('hex')
  const key = `sha256/${binaryHash}`
  const uploaded = await api(`/collections/${created.data.id}/cover`, {
    method: 'POST', body: { fileName: 'cover.png', fileData: png.toString('base64') }
  })
  assert.equal(uploaded.response.status, 200)
  assert.equal(uploaded.data.hasCover, true)
  assert.equal(JSON.stringify(uploaded.data).includes(key), false)
  const row = await db.prepare('SELECT file_data,blob_key FROM file_assets WHERE binary_hash=?').get(binaryHash)
  assert.equal(row.file_data, null)
  assert.equal(row.blob_key, key)
  assert.deepEqual(await adapter.read(key), png)
  assert.equal(await deleteOrphanFileAssets(), 0)

  assert.equal((await api(`/collections/${created.data.id}/cover`, { method: 'DELETE' })).response.status, 200)
  assert.equal(await deleteOrphanFileAssets(), 1)
  assert.deepEqual(await adapter.read(key), png)
  await adapter.delete(key)
  assert.equal(await adapter.read(key), null)
})
