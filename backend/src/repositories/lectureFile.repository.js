import crypto from 'node:crypto'
import { db } from '../data/databaseClient.js'
import { readFileBytes } from '../services/fileStorage.service.js'

function toLectureFile(row) {
  if (!row) return null
  return {
    id: row.id,
    lectureId: row.lecture_id,
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

export async function createLectureFile({
  lectureId,
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
    INSERT INTO lecture_files (
      id, lecture_id, uploader_id, original_filename, stored_filename,
      mime_type, file_size, file_data, file_asset_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    id,
    lectureId,
    uploaderId,
    originalFilename,
    storedFilename,
    mimeType,
    Number(fileSize) || 0,
    fileData,
    fileAssetId
  )
  return await findLectureFileByLectureId(lectureId)
}

export async function findLectureFileByLectureId(lectureId) {
  const file = toLectureFile(await db.prepare(`
    SELECT lecture_files.id, lecture_files.lecture_id, lecture_files.uploader_id,
           lecture_files.original_filename, lecture_files.stored_filename,
           lecture_files.mime_type, lecture_files.file_size, lecture_files.file_asset_id,
           COALESCE(file_assets.file_data, lecture_files.file_data) AS file_data,
           file_assets.blob_key,
           lecture_files.created_at, lecture_files.updated_at
    FROM lecture_files
    LEFT JOIN file_assets ON file_assets.id = lecture_files.file_asset_id
    WHERE lecture_files.lecture_id = ?
  `).get(lectureId))
  if (file && !file.fileData && file.blobKey) file.fileData = await readFileBytes(file.blobKey)
  return file
}

export async function lectureHasFile(lectureId) {
  return Boolean(await db.prepare('SELECT 1 FROM lecture_files WHERE lecture_id = ?').get(lectureId))
}
