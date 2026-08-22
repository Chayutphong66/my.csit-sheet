import crypto from 'node:crypto'
import { db } from '../data/database.js'

const requestSelect = `
  SELECT
    upload_requests.*,
    users.username AS username,
    users.email AS email,
    admin.username AS decided_by_username
  FROM upload_requests
  JOIN users ON users.id = upload_requests.user_id
  LEFT JOIN users admin ON admin.id = upload_requests.decided_by
`

function toUploadRequest(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    email: row.email,
    sheetId: row.sheet_id,
    title: row.title,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    courseId: row.course_id,
    courseName: row.course_name,
    documentType: row.document_type,
    academicYear: row.academic_year,
    uploadDate: row.upload_date,
    instructorId: row.instructor_id,
    instructorName: row.instructor_name,
    status: row.status,
    rejectionReason: row.rejection_reason,
    decidedBy: row.decided_by,
    decidedByUsername: row.decided_by_username,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  }
}

export function listCourses() {
  return db.prepare('SELECT id, name FROM courses ORDER BY name').all()
}

export function listInstructors() {
  return db.prepare('SELECT id, name FROM instructors ORDER BY name').all()
}

export function findCourseById(id) {
  return db.prepare('SELECT id, name FROM courses WHERE id = ?').get(id)
}

export function findInstructorById(id) {
  return db.prepare('SELECT id, name FROM instructors WHERE id = ?').get(id)
}

export function createUploadRequest({
  userId,
  title,
  fileName,
  fileSize,
  fileType,
  fileData = null,
  courseId = '',
  documentType = 'Sheet',
  academicYear = '',
  uploadDate = '',
  instructorId = ''
}) {
  const course = courseId ? findCourseById(courseId) : null
  const instructor = instructorId ? findInstructorById(instructorId) : null
  const id = crypto.randomUUID()

  // sheet_id and decided_by are nullable foreign keys. They must be inserted as
  // NULL (not the '' column default) until a sheet is created / an admin decides,
  // because SQLite validates a non-NULL FK value against the parent table and an
  // empty string matches no row -> "FOREIGN KEY constraint failed".
  db.prepare(`
    INSERT INTO upload_requests (
      id, user_id, sheet_id, title, file_name, file_size, file_type, file_data, course_id, course_name,
      document_type, academic_year, upload_date, instructor_id, instructor_name, status, decided_by
    )
    VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL)
  `).run(
    id,
    userId,
    title,
    fileName,
    Number(fileSize) || 0,
    fileType ?? '',
    fileData,
    course?.id ?? '',
    course?.name ?? '',
    documentType,
    academicYear,
    uploadDate,
    instructor?.id ?? '',
    instructor?.name ?? ''
  )

  return findUploadRequestById(id)
}

export function findUploadRequestsByUserId(userId) {
  return db
    .prepare(`${requestSelect} WHERE upload_requests.user_id = ? ORDER BY upload_requests.created_at DESC`)
    .all(userId)
    .map(toUploadRequest)
}

export function findUploadRequestById(id) {
  return toUploadRequest(db.prepare(`${requestSelect} WHERE upload_requests.id = ?`).get(id))
}

export function findUploadRequestFileById(id) {
  const row = db
    .prepare('SELECT file_name, file_type, file_data FROM upload_requests WHERE id = ?')
    .get(id)
  if (!row) return null
  return { fileName: row.file_name, fileType: row.file_type, fileData: row.file_data }
}

export function findAllUploadRequests() {
  return db
    .prepare(`${requestSelect} ORDER BY upload_requests.created_at DESC`)
    .all()
    .map(toUploadRequest)
}

export function updateUploadRequestStatus({ id, status, adminId = '', reason = '' }) {
  const result = db
    .prepare(`
      UPDATE upload_requests
      SET status = ?,
          rejection_reason = ?,
          decided_by = ?,
          decided_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .run(status, reason, adminId || null, id)

  return result.changes > 0 ? findUploadRequestById(id) : null
}

export function updateUploadRequestCategory({
  id,
  courseId,
  documentType,
  academicYear,
  instructorId
}) {
  const course = findCourseById(courseId)
  const instructor = findInstructorById(instructorId)

  if (!course || !instructor) return null

  const result = db
    .prepare(`
      UPDATE upload_requests
      SET course_id = ?,
          course_name = ?,
          document_type = ?,
          academic_year = ?,
          instructor_id = ?,
          instructor_name = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .run(course.id, course.name, documentType, academicYear, instructor.id, instructor.name, id)

  return result.changes > 0 ? findUploadRequestById(id) : null
}

export function completeUploadRequest(id) {
  const request = findUploadRequestById(id)
  if (!request) return null

  const sheetId = crypto.randomUUID()
  db.prepare(`
    INSERT INTO sheets (id, title, subject, status, created_at, download_count, uploader_id, reject_reason)
    VALUES (?, ?, ?, 'APPROVED', CURRENT_TIMESTAMP, 0, ?, '')
  `).run(sheetId, request.title, request.courseName || request.courseId || 'General', request.userId)

  db.prepare(`
    UPDATE upload_requests
    SET status = 'COMPLETED',
        sheet_id = ?,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(sheetId, id)

  return findUploadRequestById(id)
}

export function failUploadRequest(id) {
  const result = db
    .prepare("UPDATE upload_requests SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(id)
  return result.changes > 0 ? findUploadRequestById(id) : null
}

export function countUploadRequestsByStatus(status) {
  return db
    .prepare('SELECT COUNT(*) AS count FROM upload_requests WHERE status = ?')
    .get(status).count
}
