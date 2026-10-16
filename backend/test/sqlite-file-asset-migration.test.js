import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { ensureSqliteFileAssetStorageContract } from '../src/data/sqliteFileAssetMigration.js'

test('upgrades legacy file_assets without losing rows, foreign keys or indexes', () => {
  const database = new DatabaseSync(':memory:')
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE file_assets (
      id TEXT PRIMARY KEY,
      binary_hash TEXT NOT NULL UNIQUE,
      content_hash TEXT,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT '',
      file_size INTEGER NOT NULL DEFAULT 0,
      file_data BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_file_assets_fixture ON file_assets(content_hash);
    CREATE TABLE asset_references (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES file_assets(id)
    );
  `)
  const bytes = Buffer.from('legacy file bytes')
  database.prepare(`
    INSERT INTO file_assets (id,binary_hash,content_hash,original_filename,mime_type,file_size,file_data)
    VALUES (?,?,?,?,?,?,?)
  `).run('asset-1', 'a'.repeat(64), 'content-1', 'legacy.pdf', 'application/pdf', bytes.length, bytes)
  database.prepare('INSERT INTO asset_references (id,asset_id) VALUES (?,?)').run('reference-1', 'asset-1')

  assert.deepEqual(ensureSqliteFileAssetStorageContract(database), { migrated: true, rowCount: 1 })

  const columns = database.prepare('PRAGMA table_info(file_assets)').all()
  assert.equal(columns.find(column => column.name === 'file_data').notnull, 0)
  assert.ok(columns.some(column => column.name === 'blob_key'))
  assert.deepEqual(Buffer.from(database.prepare('SELECT file_data FROM file_assets WHERE id=?').get('asset-1').file_data), bytes)
  assert.equal(database.prepare('SELECT asset_id FROM asset_references WHERE id=?').get('reference-1').asset_id, 'asset-1')
  assert.ok(database.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_file_assets_fixture'").get())
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), [])
  assert.equal(database.prepare('PRAGMA foreign_keys').get().foreign_keys, 1)

  database.prepare(`
    INSERT INTO file_assets (id,binary_hash,original_filename,mime_type,file_size,file_data,blob_key)
    VALUES (?,?,?,?,?,?,?)
  `).run('asset-2', 'b'.repeat(64), 'external.pdf', 'application/pdf', 10, null, `sha256/${'b'.repeat(64)}`)
  assert.throws(() => database.prepare(`
    INSERT INTO file_assets (id,binary_hash,original_filename,mime_type,file_size,file_data,blob_key)
    VALUES (?,?,?,?,?,?,?)
  `).run('asset-3', 'c'.repeat(64), 'invalid.pdf', 'application/pdf', 10, null, null), /CHECK constraint failed/)
  assert.deepEqual(ensureSqliteFileAssetStorageContract(database), { migrated: false })
  database.close()
})

test('rolls back an incompatible nullable legacy table instead of losing invalid rows', () => {
  const database = new DatabaseSync(':memory:')
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE file_assets (
      id TEXT PRIMARY KEY,
      binary_hash TEXT NOT NULL UNIQUE,
      content_hash TEXT,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT '',
      file_size INTEGER NOT NULL DEFAULT 0,
      file_data BLOB,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      blob_key TEXT
    );
  `)
  database.prepare(`
    INSERT INTO file_assets (id,binary_hash,original_filename,mime_type,file_size,file_data,blob_key)
    VALUES (?,?,?,?,?,?,?)
  `).run('invalid-legacy', 'd'.repeat(64), 'invalid.pdf', 'application/pdf', 1, null, null)

  assert.throws(() => ensureSqliteFileAssetStorageContract(database), /CHECK constraint failed/)
  assert.equal(database.prepare('SELECT id FROM file_assets').get().id, 'invalid-legacy')
  assert.equal(database.prepare("SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name='file_assets_storage_contract_v2'").get().count, 0)
  assert.equal(database.prepare('PRAGMA foreign_keys').get().foreign_keys, 1)
  database.close()
})
