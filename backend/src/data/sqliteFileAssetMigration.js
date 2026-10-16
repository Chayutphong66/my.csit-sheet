const FILE_ASSET_COLUMNS = [
  'id', 'binary_hash', 'content_hash', 'original_filename', 'mime_type',
  'file_size', 'file_data', 'created_at', 'updated_at', 'blob_key'
]

function tableSql(name, ifNotExists = false) {
  return `CREATE TABLE ${ifNotExists ? 'IF NOT EXISTS ' : ''}${name} (
    id TEXT PRIMARY KEY,
    binary_hash TEXT NOT NULL UNIQUE,
    content_hash TEXT,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    file_data BLOB,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    blob_key TEXT,
    CONSTRAINT file_assets_content_location CHECK (
      file_data IS NOT NULL OR (blob_key IS NOT NULL AND length(trim(blob_key)) > 0)
    )
  )`
}

export const sqliteFileAssetTableSql = `${tableSql('file_assets', true)};`

export function ensureSqliteFileAssetStorageContract(database) {
  let columns = database.prepare('PRAGMA table_info(file_assets)').all()
  if (!columns.length) throw new Error('file_assets table is required before storage-contract migration')
  if (!columns.some(column => column.name === 'blob_key')) {
    database.exec('ALTER TABLE file_assets ADD COLUMN blob_key TEXT')
    columns = database.prepare('PRAGMA table_info(file_assets)').all()
  }

  const fileData = columns.find(column => column.name === 'file_data')
  if (!fileData) throw new Error('file_assets.file_data is required')
  const currentTableSql = database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='file_assets'").get()?.sql || ''
  const hasStorageCheck = /CONSTRAINT\s+file_assets_content_location\s+CHECK/i.test(currentTableSql)
  if (Number(fileData.notnull) === 0 && hasStorageCheck) return { migrated: false }

  const actualColumns = columns.map(column => column.name)
  const unsupported = actualColumns.filter(column => !FILE_ASSET_COLUMNS.includes(column))
  if (unsupported.length) throw new Error(`Unsupported file_assets columns: ${unsupported.join(', ')}`)

  const schemaObjects = database.prepare(`
    SELECT type, name, sql FROM sqlite_master
    WHERE tbl_name = 'file_assets' AND type IN ('index', 'trigger') AND sql IS NOT NULL
    ORDER BY type, name
  `).all()
  const rowCount = Number(database.prepare('SELECT COUNT(*) count FROM file_assets').get().count)
  const foreignKeysEnabled = Number(database.prepare('PRAGMA foreign_keys').get().foreign_keys) === 1
  let began = false

  if (foreignKeysEnabled) database.exec('PRAGMA foreign_keys = OFF')
  try {
    database.exec('BEGIN IMMEDIATE')
    began = true
    database.exec(tableSql('file_assets_storage_contract_v2'))
    database.exec(`
      INSERT INTO file_assets_storage_contract_v2 (${FILE_ASSET_COLUMNS.join(', ')})
      SELECT ${FILE_ASSET_COLUMNS.join(', ')} FROM file_assets
    `)
    const copiedCount = Number(database.prepare('SELECT COUNT(*) count FROM file_assets_storage_contract_v2').get().count)
    if (copiedCount !== rowCount) throw new Error('file_assets migration row-count verification failed')
    database.exec('DROP TABLE file_assets')
    database.exec('ALTER TABLE file_assets_storage_contract_v2 RENAME TO file_assets')
    for (const object of schemaObjects) database.exec(object.sql)
    const violations = database.prepare('PRAGMA foreign_key_check').all()
    if (violations.length) throw new Error('file_assets migration foreign-key verification failed')
    database.exec('COMMIT')
    began = false
    return { migrated: true, rowCount }
  } catch (error) {
    if (began) database.exec('ROLLBACK')
    throw error
  } finally {
    if (foreignKeysEnabled) database.exec('PRAGMA foreign_keys = ON')
  }
}
