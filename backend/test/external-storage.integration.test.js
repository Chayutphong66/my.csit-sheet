import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'
import { createStorageAdapter } from '../src/services/storageAdapter.js'

const enabled = process.env.RUN_EXTERNAL_STORAGE_TESTS === 'true'

test('isolated Supabase storage saves, reads, deduplicates and removes an object', { skip: !enabled && 'RUN_EXTERNAL_STORAGE_TESTS NOT ENABLED' }, async () => {
  assert.equal(process.env.EXTERNAL_STORAGE_SAFETY_TOKEN, 'ISOLATED-NON-PRODUCTION')
  const storageUrl = process.env.TEST_SUPABASE_URL
  const storageKey = process.env.TEST_SUPABASE_SECRET_KEY
  const storageBucket = process.env.TEST_SUPABASE_STORAGE_BUCKET
  assert.ok(storageUrl && storageKey && storageBucket, 'Dedicated TEST_SUPABASE_* credentials are required')
  assert.equal(new URL(storageUrl).protocol, 'https:')
  assert.match(storageBucket, /(staging|test|qa)/i, 'The isolated bucket name must identify staging, test or QA')
  assert.notEqual(storageUrl, process.env.PRODUCTION_SUPABASE_URL)
  assert.notEqual(storageBucket, process.env.PRODUCTION_SUPABASE_STORAGE_BUCKET)
  const bytes = Buffer.from(`Phase 7 isolated storage verification ${crypto.randomUUID()}`)
  const hash = crypto.createHash('sha256').update(bytes).digest('hex')
  const key = `sha256/${hash}`
  const adapter = createStorageAdapter({ storageDriver: 'supabase', storageUrl, storageKey, storageBucket })
  try {
    assert.equal(await adapter.save(key, bytes, { mimeType: 'application/octet-stream' }), true)
    assert.deepEqual(await adapter.read(key), bytes)
    assert.equal(await adapter.save(key, bytes, { mimeType: 'application/octet-stream' }), true)
    assert.deepEqual(await adapter.metadata(key), { size: bytes.length })
  } finally {
    await adapter.delete(key)
  }
  assert.equal(await adapter.read(key), null)
})
