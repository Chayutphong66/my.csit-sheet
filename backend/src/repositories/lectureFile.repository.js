import crypto from 'node:crypto'
import { db } from '../data/database.js'

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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function createLectureFile({
  lectureId,
  uploaderId,
  originalFilename,
  storedFilename = '',
  mimeType = '',
  fileSize = 0,
  fileData
}) {
  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO lecture_files (
      id, lecture_id, uploader_id, original_filename, stored_filename,
      mime_type, file_size, file_data, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    id,
    lectureId,
    uploaderId,
    originalFilename,
    storedFilename,
    mimeType,
    Number(fileSize) || 0,
    fileData
  )
  return findLectureFileByLectureId(lectureId)
}

export function findLectureFileByLectureId(lectureId) {
  return toLectureFile(db.prepare('SELECT * FROM lecture_files WHERE lecture_id = ?').get(lectureId))
}

export function lectureHasFile(lectureId) {
  return Boolean(db.prepare('SELECT 1 FROM lecture_files WHERE lecture_id = ?').get(lectureId))
}
