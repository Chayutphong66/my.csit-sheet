import crypto from 'node:crypto'
import { db, databaseDialect, withTransaction } from '../data/databaseClient.js'
import { deleteFileBytes, readFileBytes, storeFileBytes } from '../services/fileStorage.service.js'

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
    blobKey: row.blob_key || '',
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
  const blobKey = await storeFileBytes({
    binaryHash,
    fileData: buffer,
    metadata: { originalFilename, mimeType }
  })
  if (databaseDialect === 'postgres') {
    await db.prepare(`
      INSERT OR IGNORE INTO file_assets (
        id, binary_hash, content_hash, original_filename, mime_type, file_size, blob_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(crypto.randomUUID(), binaryHash, contentHash || null, originalFilename, mimeType, buffer.length, blobKey)
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
      (SELECT COUNT(*) FROM document_versions WHERE file_asset_id = ?) AS count
  `).get(id, id, id, id)
  return Number(row.count)
}

export async function deleteOrphanFileAssets() {
  const orphans = await db.prepare(`
    SELECT id, blob_key FROM file_assets
    WHERE NOT EXISTS (SELECT 1 FROM upload_requests WHERE upload_requests.file_asset_id = file_assets.id)
      AND NOT EXISTS (SELECT 1 FROM lecture_files WHERE lecture_files.file_asset_id = file_assets.id)
      AND NOT EXISTS (SELECT 1 FROM sheet_files WHERE sheet_files.file_asset_id = file_assets.id)
      AND NOT EXISTS (SELECT 1 FROM document_versions WHERE document_versions.file_asset_id = file_assets.id)
  `).all()
  if (!orphans.length) return 0
  const deleted = await withTransaction(async () => {
    let count = 0
    for (const orphan of orphans) {
      const result = await db.prepare('DELETE FROM file_assets WHERE id = ?').run(orphan.id)
      count += result.changes
    }
    return count
  })
  await Promise.all(orphans.map(({ blob_key: blobKey }) => deleteFileBytes(blobKey)))
  return deleted
}
