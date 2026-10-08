import crypto from 'node:crypto'
import { db, databaseDialect, withTransaction } from '../data/databaseClient.js'
import { readFileBytes, storeFileBytes } from '../services/fileStorage.service.js'
import { config } from '../config/environment.js'

function toFileAsset(row) {
  if (!row) return null
  return {
    id: row.id,
    binaryHash: row.binary_hash,
    contentHash: row.content_hash || '',
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    fileData: row.file_data,
    blobKey: row.storage_key || row.blob_key || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function hydrateFileAsset(row) {
  const asset = toFileAsset(row)
  if (asset && !asset.fileData && asset.blobKey) asset.fileData = await readFileBytes(asset.blobKey)
  return asset
}

export async function findFileAssetById(id) {
  return hydrateFileAsset(await db.prepare('SELECT * FROM file_assets WHERE id = ?').get(id))
}

export async function findFileAssetByHash(binaryHash) {
  return hydrateFileAsset(await db.prepare('SELECT * FROM file_assets WHERE binary_hash = ?').get(binaryHash))
}

export async function getOrCreateFileAsset({ binaryHash, contentHash = '', originalFilename, mimeType = '', fileData }) {
  const buffer = Buffer.from(fileData ?? [])
  if (!binaryHash || !buffer.length) throw new Error('A non-empty file and binary hash are required')
  if (crypto.createHash('sha256').update(buffer).digest('hex') !== binaryHash) throw new Error('File bytes do not match their SHA-256')
  const blobKey = await storeFileBytes({
    binaryHash,
    fileData: buffer,
    metadata: { originalFilename, mimeType }
  })
  if (databaseDialect === 'postgres') {
    const modernStorage = config.storageDriver !== 'netlify'
    await db.prepare(`
      INSERT OR IGNORE INTO file_assets (
        id, binary_hash, content_hash, original_filename, mime_type, file_size, file_data, blob_key${modernStorage ? ', storage_key, storage_provider' : ''}, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?${modernStorage ? ', ?, ?' : ''}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(crypto.randomUUID(), binaryHash, contentHash || null, originalFilename, mimeType, buffer.length, blobKey ? null : buffer, blobKey, ...(modernStorage ? [blobKey, config.storageDriver] : []))
  } else {
    await db.prepare(`
      INSERT OR IGNORE INTO file_assets (
        id, binary_hash, content_hash, original_filename, mime_type, file_size, file_data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(crypto.randomUUID(), binaryHash, contentHash || null, originalFilename, mimeType, buffer.length, buffer)
  }
  if (contentHash) {
    await db.prepare(`
      UPDATE file_assets SET content_hash = COALESCE(NULLIF(content_hash, ''), ?), updated_at = CURRENT_TIMESTAMP
      WHERE binary_hash = ?
    `).run(contentHash, binaryHash)
  }
  return await findFileAssetByHash(binaryHash)
}

export async function countFileAssets() {
  return Number((await db.prepare('SELECT COUNT(*) AS count FROM file_assets').get()).count)
}

export async function countFileAssetReferences(id) {
  const row = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM upload_requests WHERE file_asset_id = ?) +
      (SELECT COUNT(*) FROM lecture_files WHERE file_asset_id = ?) +
      (SELECT COUNT(*) FROM sheet_files WHERE file_asset_id = ?) +
      (SELECT COUNT(*) FROM document_versions WHERE file_asset_id = ?) +
      (SELECT COUNT(*) FROM users WHERE avatar_storage_key = 'sha256/' || (SELECT binary_hash FROM file_assets WHERE id = ?)) AS count
  `).get(id, id, id, id, id)
  return Number(row.count)
}

export async function deleteOrphanFileAssets() {
  return withTransaction(async () => {
    const unreferenced = `
      NOT EXISTS (SELECT 1 FROM upload_requests WHERE upload_requests.file_asset_id = file_assets.id)
      AND NOT EXISTS (SELECT 1 FROM lecture_files WHERE lecture_files.file_asset_id = file_assets.id)
      AND NOT EXISTS (SELECT 1 FROM sheet_files WHERE sheet_files.file_asset_id = file_assets.id)
      AND NOT EXISTS (SELECT 1 FROM document_versions WHERE document_versions.file_asset_id = file_assets.id)
      AND NOT EXISTS (SELECT 1 FROM users WHERE users.avatar_storage_key = 'sha256/' || file_assets.binary_hash)
    `
    const orphans = await db.prepare(`SELECT id FROM file_assets WHERE ${unreferenced}${databaseDialect === 'postgres' ? ' FOR UPDATE' : ''}`).all()
    let deleted = 0
    for (const orphan of orphans) {
      deleted += (await db.prepare(`DELETE FROM file_assets WHERE id = ? AND ${unreferenced}`).run(orphan.id)).changes
    }
    // External content-addressed objects are retained intentionally. Deleting after
    // COMMIT races a new reference/upload of the same SHA. A future reviewed GC
    // must coordinate object deletion with writers; never delete a shared object here.
    return deleted
  })
}
