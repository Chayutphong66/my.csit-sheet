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
    rejectReason: row.reject_reason
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
    users.username AS uploader_username,
    users.email AS uploader_email
  FROM sheets
  JOIN users ON users.id = sheets.uploader_id
`

export function findSheetsByUploaderId(uploaderId) {
  return db
    .prepare(`${sheetSelect} WHERE sheets.uploader_id = ? ORDER BY sheets.created_at DESC`)
    .all(uploaderId)
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
