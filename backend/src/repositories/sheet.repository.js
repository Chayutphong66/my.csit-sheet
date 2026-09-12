import { db } from '../data/database.js'

function toSheet(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    status: row.status,
    createdAt: row.created_at,
    downloadCount: row.download_count,
    uploaderId: row.uploader_id,
    uploaderUsername: row.uploader_username,
    uploaderEmail: row.uploader_email,
    rejectReason: row.reject_reason,
    sourceRequestId: row.source_request_id,
    fileName: row.file_name,
    documentType: row.document_type,
    academicYear: row.academic_year,
    courseId: row.course_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    semester: row.semester,
    fileHash: row.file_hash,
    instructor: row.instructor_name,
    hasFile: Boolean(row.has_file)
  }
}

const sheetSelect = `
  SELECT
    sheets.id,
    sheets.title,
    sheets.subject,
    sheets.status,
    sheets.created_at,
    sheets.download_count,
    sheets.uploader_id,
    sheets.reject_reason,
    sheets.source_request_id,
    users.username AS uploader_username,
    users.email AS uploader_email,
    sheet_files.original_filename AS file_name,
    upload_requests.document_type AS document_type,
    sheets.academic_year AS academic_year,
    sheets.course_id AS course_id,
    courses.code AS course_code,
    courses.name AS course_name,
    sheets.semester AS semester,
    sheets.file_hash AS file_hash,
    upload_requests.instructor_name AS instructor_name,
    CASE WHEN sheet_files.id IS NULL THEN 0 ELSE 1 END AS has_file
  FROM sheets
  JOIN users ON users.id = sheets.uploader_id
  LEFT JOIN courses ON courses.id = sheets.course_id
  LEFT JOIN upload_requests ON upload_requests.id = sheets.source_request_id
  LEFT JOIN sheet_files ON sheet_files.sheet_id = sheets.id
`

export function findSheetsByUploaderId(uploaderId) {
  return db
    .prepare(`${sheetSelect} WHERE sheets.uploader_id = ? ORDER BY sheets.created_at DESC`)
    .all(uploaderId)
    .map(toSheet)
}

export function findRecommendedSheets({ limit = 6, excludeUploaderId = null } = {}) {
  const where = excludeUploaderId
    ? `WHERE sheets.status = 'APPROVED' AND sheets.uploader_id != ?`
    : `WHERE sheets.status = 'APPROVED'`

  const params = excludeUploaderId ? [excludeUploaderId, limit] : [limit]

  return db
    .prepare(
      `${sheetSelect} ${where} ORDER BY sheets.download_count DESC, sheets.created_at DESC LIMIT ?`
    )
    .all(...params)
    .map(toSheet)
}

export function findAllSheets() {
  return db.prepare(`${sheetSelect} ORDER BY sheets.created_at DESC`).all().map(toSheet)
}

export function findSheetById(id) {
  return toSheet(db.prepare(`${sheetSelect} WHERE sheets.id = ?`).get(id))
}

export function incrementSheetDownloadCount(id) {
  db.prepare('UPDATE sheets SET download_count = download_count + 1 WHERE id = ?').run(id)
}

export function findApprovedSheets() {
  return db
    .prepare(`${sheetSelect} WHERE sheets.status = 'APPROVED' ORDER BY sheets.created_at DESC`)
    .all()
    .map(toSheet)
}

export function findPendingSheets() {
  return db
    .prepare(`${sheetSelect} WHERE sheets.status = 'PENDING' ORDER BY sheets.created_at DESC`)
    .all()
    .map(toSheet)
}

export function updateSheetStatus(id, status, rejectReason = '') {
  const result = db
    .prepare('UPDATE sheets SET status = ?, reject_reason = ? WHERE id = ?')
    .run(status, rejectReason, id)

  return result.changes > 0
}

export function countSheets() {
  return db.prepare('SELECT COUNT(*) AS count FROM sheets').get().count
}

export function countSheetsByStatus(status) {
  return db.prepare('SELECT COUNT(*) AS count FROM sheets WHERE status = ?').get(status).count
}
