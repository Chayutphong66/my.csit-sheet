import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { once } from 'node:events'
import { validateLocalEphemeralStorageEnvironment } from '../src/services/ephemeralStorageSafety.js'

const enabled = process.env.RUN_EXTERNAL_STORAGE_TESTS === 'true'

function authenticatedHeaders(secret) {
  return {
    apikey: secret,
    ...(secret.startsWith('sb_secret_') ? {} : { authorization: `Bearer ${secret}` })
  }
}

function objectUrl(origin, bucket, prefix, key) {
  return `${origin}/storage/v1/object/${encodeURIComponent(bucket)}/${`${prefix}/${key}`.split('/').map(encodeURIComponent).join('/')}`
}

test('ephemeral Supabase application flow is private, retryable, run-scoped and reference-safe', { skip: !enabled && 'RUN_EXTERNAL_STORAGE_TESTS NOT ENABLED' }, async () => {
  const { storageUrl, storageKey, storageBucket, storagePrefix } = validateLocalEphemeralStorageEnvironment(process.env)
  const parsedUrl = new URL(storageUrl)
  assert.equal(parsedUrl.protocol, 'http:')
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(parsedUrl.hostname))
  assert.equal(parsedUrl.pathname, '/')
  assert.match(storagePrefix, /^phase7b\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/)

  const evidencePath = path.resolve(process.env.EXTERNAL_STORAGE_EVIDENCE_PATH || 'artifacts/external-storage-verification.json')
  await mkdir(path.dirname(evidencePath), { recursive: true })
  await writeFile(evidencePath, JSON.stringify({ status: 'STARTED', provider: 'supabase-local', ephemeral: true }, null, 2))

  const bucketResponse = await fetch(`${parsedUrl.origin}/storage/v1/bucket/${encodeURIComponent(storageBucket)}`, {
    headers: authenticatedHeaders(storageKey)
  })
  assert.equal(bucketResponse.ok, true, `Unable to inspect isolated bucket metadata (${bucketResponse.status})`)
  const bucketMetadata = await bucketResponse.json()
  assert.equal(bucketMetadata.public, false, 'The isolated verification bucket must be private')

  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'csit-sheet-storage-'))
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_DRIVER = 'sqlite'
  process.env.DATABASE_PATH = path.join(temporaryDirectory, 'external-storage.sqlite')
  process.env.STORAGE_DRIVER = 'supabase'
  process.env.SUPABASE_URL = storageUrl
  process.env.SUPABASE_SECRET_KEY = storageKey
  process.env.SUPABASE_STORAGE_BUCKET = storageBucket
  process.env.SUPABASE_STORAGE_PREFIX = storagePrefix
  process.env.JWT_SECRET = `phase7b1-${crypto.randomBytes(24).toString('hex')}`
  const { createStorageAdapter } = await import('../src/services/storageAdapter.js')
  const adapterConfiguration = { storageDriver: 'supabase', storageUrl, storageKey, storageBucket, storagePrefix, externalStorageTestMode: 'local-ephemeral' }
  const adapter = createStorageAdapter(adapterConfiguration)
  const cleanupKeys = new Set()
  let server
  let closeDatabase
  let verificationComplete = false
  try {
    assert.equal(await adapter.read(`phase7b1/missing-${crypto.randomUUID()}`), null)

    const bytes = Buffer.from(`Phase 7B.1 retry fixture ${crypto.randomUUID()}`)
    const key = `sha256/${crypto.createHash('sha256').update(bytes).digest('hex')}`
    cleanupKeys.add(key)
    let failFirstUpload = true
    const retryAdapter = createStorageAdapter(adapterConfiguration, async (url, options) => {
      if (options.method === 'POST' && failFirstUpload) {
        failFirstUpload = false
        return new Response(JSON.stringify({ code: 'TemporaryFailure' }), { status: 503, headers: { 'content-type': 'application/json' } })
      }
      return fetch(url, options)
    })
    await assert.rejects(retryAdapter.save(key, bytes), error => error.code === 'STORAGE_UNAVAILABLE' && error.operation === 'upload')
    assert.equal(await retryAdapter.save(key, bytes), true)
    assert.deepEqual(await adapter.read(key), bytes)
    assert.deepEqual(await adapter.metadata(key), { size: bytes.length })
    assert.equal(await adapter.save(key, bytes), true)
    await assert.rejects(adapter.save(key, Buffer.from('different bytes')), error => error.code === 'STORAGE_UNAVAILABLE')

    const unauthenticated = await fetch(objectUrl(parsedUrl.origin, storageBucket, storagePrefix, key))
    assert.equal(unauthenticated.ok, false, 'A private object must not be readable without server credentials')
    assert.notDeepEqual(Buffer.from(await unauthenticated.arrayBuffer()), bytes)

    const partialBytes = Buffer.from(`Phase 7B.1 partial success ${crypto.randomUUID()}`)
    const partialKey = `sha256/${crypto.createHash('sha256').update(partialBytes).digest('hex')}`
    cleanupKeys.add(partialKey)
    await adapter.save(partialKey, partialBytes)
    const rejectedKey = `sha256/${crypto.randomBytes(32).toString('hex')}`
    const partialFailureAdapter = createStorageAdapter(adapterConfiguration, async (url, options) => {
      if (options.method === 'POST' && url.endsWith(rejectedKey)) return new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } })
      return fetch(url, options)
    })
    await assert.rejects(partialFailureAdapter.save(rejectedKey, Buffer.from('rejected fixture')), error => error.code === 'STORAGE_UNAVAILABLE')
    assert.deepEqual(await adapter.read(partialKey), partialBytes)
    assert.equal(await adapter.read(rejectedKey), null)

    const secretFreeFailure = createStorageAdapter(adapterConfiguration, async () => new Response(JSON.stringify({
      code: 'AccessDenied', message: `Rejected ${storageKey} at ${storageUrl} for ${key}`
    }), { status: 403, headers: { 'content-type': 'application/json' } }))
    await assert.rejects(secretFreeFailure.read(key), error => {
      const diagnostic = JSON.stringify({ message: error.message, ...error })
      return !diagnostic.includes(storageKey) && !diagnostic.includes(storageUrl) && !diagnostic.includes(key.slice(7))
    })

    const database = await import('../src/data/databaseClient.js')
    closeDatabase = database.closeDatabase
    assert.equal(database.databaseDialect, 'sqlite', 'Application integration must use the ephemeral SQLite database')
    const { db } = database
    const { createUser } = await import('../src/repositories/user.repository.js')
    const { hashPassword } = await import('../src/services/password.service.js')
    const { createAccessToken } = await import('../src/services/token.service.js')
    const owner = await createUser({
      id: crypto.randomUUID(), username: `storage${Date.now()}`,
      email: `storage-${crypto.randomUUID()}@example.invalid`, password: hashPassword('StorageFixture123'), role: 'USER'
    })
    const token = createAccessToken(owner)
    const { default: app } = await import('../src/app.js')
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}/api`
    async function api(route, { method = 'GET', body, authenticated = true } = {}) {
      const response = await fetch(base + route, {
        method,
        headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(authenticated ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
      })
      const responseBytes = Buffer.from(await response.arrayBuffer())
      let data
      try { data = responseBytes.length ? JSON.parse(responseBytes.toString()) : null } catch { data = responseBytes }
      return { response, data }
    }

    const created = await api('/collections', { method: 'POST', body: { name: 'External storage cover verification', collectionType: 'MIXED' } })
    assert.equal(created.response.status, 201)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKsAAAAASUVORK5CYII=', 'base64')
    const coverHash = crypto.createHash('sha256').update(png).digest('hex')
    const coverKey = `sha256/${coverHash}`
    cleanupKeys.add(coverKey)
    const uploaded = await api(`/collections/${created.data.id}/cover`, { method: 'POST', body: { fileName: 'cover.png', fileData: png.toString('base64') } })
    assert.equal(uploaded.response.status, 200)
    assert.equal(uploaded.data.hasCover, true)
    assert.equal(JSON.stringify(uploaded.data).includes(coverKey), false)
    const asset = await db.prepare('SELECT id,blob_key,file_data FROM file_assets WHERE binary_hash=?').get(coverHash)
    assert.equal(asset.blob_key, coverKey)
    assert.equal(asset.file_data, null)
    const { deleteOrphanFileAssets } = await import('../src/repositories/fileAsset.repository.js')
    assert.equal(await deleteOrphanFileAssets(), 0, 'Referenced cover assets must not be garbage-collected')
    assert.deepEqual(await adapter.read(coverKey), png)
    assert.equal((await api(`/collections/published/${created.data.slug}/cover`, { authenticated: false })).response.status, 401)
    assert.equal((await api(`/collections/${created.data.id}/cover`, { method: 'DELETE' })).response.status, 200)
    assert.equal(await deleteOrphanFileAssets(), 1)
    assert.deepEqual(await adapter.read(coverKey), png, 'Database cleanup must not race-delete shared external bytes')

    verificationComplete = true
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    if (closeDatabase) await closeDatabase()
    for (const key of cleanupKeys) {
      try { await adapter.delete(key) } catch { /* Preserve the primary test error; verify cleanup below. */ }
    }
    for (const key of cleanupKeys) assert.equal(await adapter.read(key), null, 'Test object cleanup failed')
    await rm(temporaryDirectory, { recursive: true, force: true })
    if (verificationComplete) {
      await writeFile(evidencePath, JSON.stringify({
        status: 'PASSED', provider: 'supabase-local', ephemeral: true, privateBucket: true, runScopedPrefix: true,
        upload: true, download: true, metadata: true, contentIntegrity: true, deduplication: true,
        missingFile: true, unauthorizedAccess: true, retry: true, partialFailure: true,
        coverLifecycle: true, referencedObjectProtection: true, cleanup: true
      }, null, 2))
    }
  }
})
