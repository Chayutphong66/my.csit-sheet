import crypto from 'node:crypto'
import { db } from '../data/database.js'

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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function createSheetFile({
  sheetId,
  uploaderId,
  originalFilename,
  storedFilename = '',
  mimeType = '',
  fileSize = 0,
  fileData
}) {
  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO sheet_files (
      id, sheet_id, uploader_id, original_filename, stored_filename,
      mime_type, file_size, file_data, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    id,
    sheetId,
    uploaderId,
    originalFilename,
    storedFilename,
    mimeType,
    Number(fileSize) || 0,
    fileData
  )
  return findSheetFileBySheetId(sheetId)
}

export function findSheetFileBySheetId(sheetId) {
  return toSheetFile(db.prepare('SELECT * FROM sheet_files WHERE sheet_id = ?').get(sheetId))
}

export function sheetHasFile(sheetId) {
  return Boolean(db.prepare('SELECT 1 FROM sheet_files WHERE sheet_id = ?').get(sheetId))
}
