import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'
import { createStorageAdapter } from '../src/services/storageAdapter.js'
import { validateLocalEphemeralStorageEnvironment } from '../src/services/ephemeralStorageSafety.js'

const enabled = process.env.RUN_EXTERNAL_STORAGE_TESTS === 'true'

test('ephemeral Supabase storage saves, reads, deduplicates and removes only its manifested object', { skip: !enabled && 'RUN_EXTERNAL_STORAGE_TESTS NOT ENABLED' }, async () => {
  const { storageUrl, storageKey, storageBucket, storagePrefix } = validateLocalEphemeralStorageEnvironment(process.env)
  const bytes = Buffer.from(`Phase 7 isolated storage verification ${crypto.randomUUID()}`)
  const hash = crypto.createHash('sha256').update(bytes).digest('hex')
  const key = `sha256/${hash}`
  const manifest = new Set([key])
  const adapter = createStorageAdapter({ storageDriver: 'supabase', storageUrl, storageKey, storageBucket, storagePrefix, externalStorageTestMode: 'local-ephemeral' })
  try {
    assert.equal(await adapter.save(key, bytes, { mimeType: 'application/octet-stream' }), true)
    assert.deepEqual(await adapter.read(key), bytes)
    assert.equal(await adapter.save(key, bytes, { mimeType: 'application/octet-stream' }), true)
    assert.deepEqual(await adapter.metadata(key), { size: bytes.length })
  } finally {
    for (const manifestedKey of manifest) await adapter.delete(manifestedKey)
  }
  assert.equal(await adapter.read(key), null)
})
