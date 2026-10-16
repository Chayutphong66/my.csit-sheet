import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'csit-file-assets-'))
process.env.NODE_ENV = 'test'
process.env.DATABASE_DRIVER = 'sqlite'
process.env.DATABASE_PATH = path.join(temporaryDirectory, 'file-assets.sqlite')
process.env.STORAGE_DRIVER = 'database'
process.env.SKIP_DB_SEED = '1'

const { db, closeDatabase } = await import('../src/data/databaseClient.js')
const { findFileAssetByHash, getOrCreateFileAsset } = await import('../src/repositories/fileAsset.repository.js')

after(async () => {
  await closeDatabase()
  rmSync(temporaryDirectory, { recursive: true, force: true })
})

test('fresh SQLite schema accepts binary assets and rejects missing storage locations', async () => {
  const columns = await db.prepare('PRAGMA table_info(file_assets)').all()
  assert.equal(columns.find(column => column.name === 'file_data').notnull, 0)

  const bytes = Buffer.from('local binary asset integrity fixture')
  const binaryHash = crypto.createHash('sha256').update(bytes).digest('hex')
  const asset = await getOrCreateFileAsset({
    binaryHash, originalFilename: 'fixture.pdf', mimeType: 'application/pdf', fileData: bytes
  })
  assert.ok(asset.id)
  assert.deepEqual(Buffer.from(asset.fileData), bytes)
  const row = await db.prepare('SELECT file_data,blob_key FROM file_assets WHERE id=?').get(asset.id)
  assert.deepEqual(Buffer.from(row.file_data), bytes)
  assert.equal(row.blob_key, null)

  await assert.rejects(db.prepare(`
    INSERT INTO file_assets (id,binary_hash,original_filename,mime_type,file_size,file_data,blob_key)
    VALUES (?,?,?,?,?,?,?)
  `).run('invalid-asset', 'f'.repeat(64), 'invalid.pdf', 'application/pdf', 1, null, null), /CHECK constraint failed/)
})

test('duplicate and concurrent asset creation returns one readable asset', async () => {
  const bytes = Buffer.from('deduplicated bytes')
  const binaryHash = crypto.createHash('sha256').update(bytes).digest('hex')
  const values = await Promise.all(Array.from({ length: 4 }, () => getOrCreateFileAsset({
    binaryHash, contentHash: 'semantic-content', originalFilename: 'same.pdf', mimeType: 'application/pdf', fileData: bytes
  })))
  assert.equal(new Set(values.map(value => value.id)).size, 1)
  assert.equal((await db.prepare('SELECT COUNT(*) count FROM file_assets WHERE binary_hash=?').get(binaryHash)).count, 1)
  assert.deepEqual(Buffer.from((await findFileAssetByHash(binaryHash)).fileData), bytes)
})

test('non-duplicate constraint failures are visible as explicit persistence errors', async () => {
  const bytes = Buffer.from('constraint visibility fixture')
  const binaryHash = crypto.createHash('sha256').update(bytes).digest('hex')
  await assert.rejects(
    getOrCreateFileAsset({ binaryHash, originalFilename: null, mimeType: 'application/pdf', fileData: bytes }),
    error => error.code === 'FILE_ASSET_PERSISTENCE_ERROR' && error.status === 500 && Boolean(error.cause)
  )
  assert.equal(await findFileAssetByHash(binaryHash), null)
})
