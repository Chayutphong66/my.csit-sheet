import crypto from 'node:crypto'
import { db } from '../data/database.js'

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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function findFileAssetById(id) {
  return toFileAsset(db.prepare('SELECT * FROM file_assets WHERE id = ?').get(id))
}

export function findFileAssetByHash(binaryHash) {
  return toFileAsset(db.prepare('SELECT * FROM file_assets WHERE binary_hash = ?').get(binaryHash))
}

export function getOrCreateFileAsset({ binaryHash, contentHash = '', originalFilename, mimeType = '', fileData }) {
  const buffer = Buffer.from(fileData ?? [])
  if (!binaryHash || !buffer.length) throw new Error('A non-empty file and binary hash are required')
  db.prepare(`
    INSERT OR IGNORE INTO file_assets (
      id, binary_hash, content_hash, original_filename, mime_type, file_size, file_data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(crypto.randomUUID(), binaryHash, contentHash || null, originalFilename, mimeType, buffer.length, buffer)
  if (contentHash) {
    db.prepare(`
      UPDATE file_assets SET content_hash = COALESCE(NULLIF(content_hash, ''), ?), updated_at = CURRENT_TIMESTAMP
      WHERE binary_hash = ?
    `).run(contentHash, binaryHash)
  }
  return findFileAssetByHash(binaryHash)
}

export function countFileAssets() {
  return Number(db.prepare('SELECT COUNT(*) AS count FROM file_assets').get().count)
}

export function countFileAssetReferences(id) {
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM upload_requests WHERE file_asset_id = ?) +
      (SELECT COUNT(*) FROM lecture_files WHERE file_asset_id = ?) +
      (SELECT COUNT(*) FROM sheet_files WHERE file_asset_id = ?) AS count
  `).get(id, id, id)
  return Number(row.count)
}

export function deleteOrphanFileAssets() {
  return db.prepare(`
    DELETE FROM file_assets
    WHERE NOT EXISTS (SELECT 1 FROM upload_requests WHERE upload_requests.file_asset_id = file_assets.id)
      AND NOT EXISTS (SELECT 1 FROM lecture_files WHERE lecture_files.file_asset_id = file_assets.id)
      AND NOT EXISTS (SELECT 1 FROM sheet_files WHERE sheet_files.file_asset_id = file_assets.id)
  `).run().changes
}
