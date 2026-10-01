import crypto from 'node:crypto'
import { db } from '../data/databaseClient.js'
import { readFileBytes } from '../services/fileStorage.service.js'

function toSheetFile(row) {
  if (!row) return null
  return {
    id: row.id,
    sheetId: row.sheet_id,
    uploaderId: row.uploader_id,
    originalFilename: row.original_filename,
    storedFilename: row.stored_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    fileData: row.file_data,
    fileAssetId: row.file_asset_id,
    blobKey: row.blob_key || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function createSheetFile({
  sheetId,
  uploaderId,
  originalFilename,
  storedFilename = '',
  mimeType = '',
  fileSize = 0,
  fileData = Buffer.alloc(0),
  fileAssetId = null
}) {
  const id = crypto.randomUUID()
  await db.prepare(`
    INSERT INTO sheet_files (
      id, sheet_id, uploader_id, original_filename, stored_filename,
      mime_type, file_size, file_data, file_asset_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    id,
    sheetId,
    uploaderId,
    originalFilename,
    storedFilename,
    mimeType,
    Number(fileSize) || 0,
    fileData,
    fileAssetId
  )
  return await findSheetFileBySheetId(sheetId)
}

export async function findSheetFileBySheetId(sheetId) {
  const file = toSheetFile(await db.prepare(`
    SELECT sheet_files.id, sheet_files.sheet_id, sheet_files.uploader_id,
           sheet_files.original_filename, sheet_files.stored_filename,
           sheet_files.mime_type, sheet_files.file_size, sheet_files.file_asset_id,
           COALESCE(file_assets.file_data, sheet_files.file_data) AS file_data,
           file_assets.blob_key,
           sheet_files.created_at, sheet_files.updated_at
    FROM sheet_files
    LEFT JOIN file_assets ON file_assets.id = sheet_files.file_asset_id
    WHERE sheet_files.sheet_id = ?
  `).get(sheetId))
  if (file && !file.fileData && file.blobKey) file.fileData = await readFileBytes(file.blobKey)
  return file
}

export async function sheetHasFile(sheetId) {
  return Boolean(await db.prepare('SELECT 1 FROM sheet_files WHERE sheet_id = ?').get(sheetId))
}
