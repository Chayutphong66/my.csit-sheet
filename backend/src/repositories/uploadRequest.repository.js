import crypto from 'node:crypto'
import { db } from '../data/database.js'
import { createLecture } from './lecture.repository.js'
import { createLectureFile, lectureHasFile } from './lectureFile.repository.js'
import { createSheetFile, sheetHasFile } from './sheetFile.repository.js'

export function normalizeDocumentType(documentType) {
  const value = String(documentType ?? '').trim().toLowerCase()
  if (value === 'lecture') return 'Lecture'
  if (value === 'sheet') return 'Sheet'
  return null
}

export function normalizeTitle(title) {
  return String(title ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

const requestSelect = `
  SELECT
    upload_requests.*,
    users.username AS username,
    users.email AS email,
    admin.username AS decided_by_username,
    CASE WHEN upload_requests.file_data IS NULL THEN 0 ELSE 1 END AS has_file
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
    lectureId: row.lecture_id,
    sheetId: row.sheet_id,
    title: row.title,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    courseId: row.course_id,
    courseName: row.course_name,
    documentType: normalizeDocumentType(row.document_type) ?? row.document_type,
    academicYear: row.academic_year,
    semester: row.semester,
    uploadDate: row.upload_date,
    instructorId: row.instructor_id,
    instructorName: row.instructor_name,
    status: row.status,
    duplicateStatus: row.duplicate_status || 'NONE',
    rejectionType: row.rejection_type || 'STANDARD',
    fileHash: row.file_hash,
    rejectionReason: row.rejection_reason,
    decidedBy: row.decided_by,
    decidedByUsername: row.decided_by_username,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    hasFile: Boolean(row.has_file)
  }
}

export function listCourses() {
  return db.prepare('SELECT id, code, name, description FROM courses ORDER BY code, name').all()
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
  semester = '',
  uploadDate = '',
  instructorId = ''
}) {
  const course = courseId ? findCourseById(courseId) : null
  const instructor = instructorId ? findInstructorById(instructorId) : null
  const id = crypto.randomUUID()
  const fileHash = fileData ? crypto.createHash('sha256').update(Buffer.from(fileData)).digest('hex') : ''
  const normalizedTitle = normalizeTitle(title)
  const duplicateStatus = classifyDuplicate({
    fileHash, courseId: course?.id ?? '', academicYear, semester, documentType, normalizedTitle
  })

  // sheet_id and decided_by are nullable foreign keys. They must be inserted as
  // NULL (not the '' column default) until a sheet is created / an admin decides,
  // because SQLite validates a non-NULL FK value against the parent table and an
  // empty string matches no row -> "FOREIGN KEY constraint failed".
  db.prepare(`
    INSERT INTO upload_requests (
      id, user_id, lecture_id, sheet_id, title, file_name, file_size, file_type, file_data, course_id, course_name,
      document_type, academic_year, semester, upload_date, instructor_id, instructor_name,
      file_hash, normalized_title, duplicate_status, status, decided_by
    )
    VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL)
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
    normalizeDocumentType(documentType) ?? 'Sheet',
    academicYear,
    semester,
    uploadDate,
    instructor?.id ?? '',
    instructor?.name ?? '',
    fileHash,
    normalizedTitle,
    duplicateStatus
  )

  return findUploadRequestById(id)
}

export function findUploadRequestsByUserId(userId) {
  return db
    .prepare(`${requestSelect} WHERE upload_requests.user_id = ? ORDER BY upload_requests.created_at DESC`)
    .all(userId)
    .map(toUploadRequest)
}

export function findContributionSummaryByUserId(userId, limit = 5) {
  const totals = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN document_type = 'Lecture' THEN 1 ELSE 0 END) AS lectures,
      SUM(CASE WHEN document_type = 'Sheet' THEN 1 ELSE 0 END) AS sheets,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS published,
      SUM(CASE WHEN status IN ('PENDING', 'PROCESSING', 'APPROVED') THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status IN ('REJECTED', 'FAILED') THEN 1 ELSE 0 END) AS rejected
    FROM upload_requests WHERE user_id = ?
  `).get(userId)
  return {
    total: Number(totals.total || 0),
    lectures: Number(totals.lectures || 0),
    sheets: Number(totals.sheets || 0),
    published: Number(totals.published || 0),
    pending: Number(totals.pending || 0),
    rejected: Number(totals.rejected || 0),
    recent: findUploadRequestsByUserId(userId).slice(0, limit)
  }
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

export function findDuplicateMatches(requestOrId) {
  const request = typeof requestOrId === 'string' ? findUploadRequestById(requestOrId) : requestOrId
  if (!request) return []
  const type = normalizeDocumentType(request.documentType)
  const params = {
    id: request.id,
    hash: request.fileHash || '',
    courseId: request.courseId || '',
    year: request.academicYear || '',
    semester: request.semester || '',
    type,
    title: normalizeTitle(request.title)
  }
  const rows = db.prepare(`
    SELECT 'REQUEST' AS source, id, title, file_name AS file_name, document_type AS document_type,
           status, file_hash, course_id, academic_year, semester, normalized_title
    FROM upload_requests
    WHERE id != @id AND status = 'PENDING'
      AND ((@hash != '' AND file_hash = @hash) OR
        (course_id = @courseId AND academic_year = @year AND semester = @semester
         AND document_type = @type AND normalized_title = @title))
    UNION ALL
    SELECT 'LECTURE', id, title, file_name, 'Lecture', status, file_hash, course_id, academic_year, semester, normalized_title
    FROM lectures
    WHERE status = 'APPROVED'
      AND ((@hash != '' AND file_hash = @hash) OR
        (@type = 'Lecture' AND course_id = @courseId AND academic_year = @year
         AND semester = @semester AND normalized_title = @title))
    UNION ALL
    SELECT 'SHEET', sheets.id, sheets.title, COALESCE(sheet_files.original_filename, ''), 'Sheet', sheets.status,
           sheets.file_hash, sheets.course_id, sheets.academic_year, sheets.semester, sheets.normalized_title
    FROM sheets LEFT JOIN sheet_files ON sheet_files.sheet_id = sheets.id
    WHERE sheets.status = 'APPROVED'
      AND ((@hash != '' AND sheets.file_hash = @hash) OR
        (@type = 'Sheet' AND sheets.course_id = @courseId AND sheets.academic_year = @year AND sheets.semester = @semester
         AND sheets.normalized_title = @title))
  `).all(params)
  return rows.map((row) => ({
    source: row.source,
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    documentType: row.document_type,
    status: row.status,
    matchType: params.hash && row.file_hash === params.hash ? 'EXACT_DUPLICATE' : 'POSSIBLE_DUPLICATE'
  }))
}

function classifyDuplicate(candidate) {
  const matches = findDuplicateMatches({ id: '', title: candidate.normalizedTitle, fileHash: candidate.fileHash,
    courseId: candidate.courseId, academicYear: candidate.academicYear, semester: candidate.semester,
    documentType: candidate.documentType })
  if (matches.some((match) => match.matchType === 'EXACT_DUPLICATE')) return 'EXACT_DUPLICATE'
  if (matches.length) return 'POSSIBLE_DUPLICATE'
  return 'NONE'
}

export function updateUploadRequestStatus({ id, status, adminId = '', reason = '', rejectionType = 'STANDARD' }) {
  const result = db
    .prepare(`
      UPDATE upload_requests
      SET status = ?,
          rejection_reason = ?,
          rejection_type = ?,
          decided_by = ?,
          decided_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .run(status, reason, rejectionType, adminId || null, id)

  return result.changes > 0 ? findUploadRequestById(id) : null
}

export function updateUploadRequestCategory({
  id,
  courseId,
  documentType,
  academicYear,
  semester,
  instructorId
}) {
  const course = findCourseById(courseId)
  const instructor = findInstructorById(instructorId)
  const normalizedType = normalizeDocumentType(documentType)

  if (!course || !instructor || !normalizedType) return null

  const result = db
    .prepare(`
      UPDATE upload_requests
      SET course_id = ?,
          course_name = ?,
          document_type = ?,
          academic_year = ?,
          semester = ?,
          instructor_id = ?,
          instructor_name = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .run(course.id, course.name, normalizedType, academicYear, semester, instructor.id, instructor.name, id)

  return result.changes > 0 ? findUploadRequestById(id) : null
}

function isLectureDocument(documentType) {
  return normalizeDocumentType(documentType) === 'Lecture'
}

// Determine whether a request has already produced a public record, so publishing is
// idempotent (re-approving, or a stray /complete call, never creates duplicates).
function findPublishedRecord(request) {
  if (isLectureDocument(request.documentType)) {
    if (request.lectureId) {
      const record = db.prepare('SELECT id FROM lectures WHERE id = ?').get(request.lectureId) ?? null
      if (record) return { type: 'Lecture', id: record.id, hasFile: lectureHasFile(record.id) }
    }
    const record = db.prepare('SELECT id FROM lectures WHERE source_request_id = ?').get(request.id) ?? null
    return record ? { type: 'Lecture', id: record.id, hasFile: lectureHasFile(record.id) } : null
  }
  if (request.sheetId) {
    const record = db.prepare('SELECT id FROM sheets WHERE id = ?').get(request.sheetId) ?? null
    return record ? { type: 'Sheet', id: record.id, hasFile: sheetHasFile(record.id) } : null
  }
  const record = db.prepare('SELECT id FROM sheets WHERE source_request_id = ?').get(request.id) ?? null
  return record ? { type: 'Sheet', id: record.id, hasFile: sheetHasFile(record.id) } : null
}

// Publish an approved upload request into the correct public catalog.
// document_type "Lecture" -> lectures page; anything else -> sheets page.
// The public record is linked to this request via source_request_id so the stored
// file BLOB stays reachable for download. Insert + status update run in one
// transaction to avoid a half-published request.
export function publishUploadRequest(id, { adminId = '' } = {}) {
  const request = findUploadRequestById(id)
  if (!request) return null

  const existing = findPublishedRecord(request)
  if (existing?.hasFile) {
    db.prepare(
      `UPDATE upload_requests
       SET status = 'COMPLETED',
           decided_by = COALESCE(decided_by, ?),
           decided_at = COALESCE(NULLIF(decided_at, ''), CURRENT_TIMESTAMP),
           completed_at = COALESCE(NULLIF(completed_at, ''), CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(adminId || null, id)
    return findUploadRequestById(id)
  }

  const file = findUploadRequestFileById(id)
  if ((!existing || !existing.hasFile) && (!file || !file.fileData)) {
    throw new Error('No uploaded file is available to publish')
  }

  const subject = request.courseName || request.courseId || 'General'

  db.exec('BEGIN')
  try {
    if (isLectureDocument(request.documentType)) {
      const lecture = existing
        ? { id: existing.id }
        : createLecture({
            title: request.title,
            subject,
            instructor: request.instructorName || '',
            description: '',
            academicYear: request.academicYear || '',
            courseId: request.courseId || '',
            semester: request.semester || '',
            fileHash: request.fileHash || '',
            uploaderId: request.userId,
            fileName: request.fileName || '',
            sourceRequestId: id
          })
      if (!existing?.hasFile) {
        createLectureFile({
          lectureId: lecture.id,
          uploaderId: request.userId,
          originalFilename: file.fileName || request.fileName || 'download',
          mimeType: file.fileType || request.fileType || 'application/octet-stream',
          fileSize: request.fileSize,
          fileData: file.fileData
        })
      }
      db.prepare(
        `UPDATE upload_requests
         SET status = 'COMPLETED',
             decided_by = COALESCE(decided_by, ?),
             decided_at = COALESCE(NULLIF(decided_at, ''), CURRENT_TIMESTAMP),
             lecture_id = ?,
             file_data = NULL,
             completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(adminId || null, lecture.id, id)
    } else {
      const sheetId = existing?.id ?? crypto.randomUUID()
      if (!existing) {
        db.prepare(`
          INSERT INTO sheets (
            id, title, subject, status, created_at, download_count, uploader_id, reject_reason, source_request_id,
            course_id, academic_year, semester, normalized_title, file_hash, updated_at
          ) VALUES (?, ?, ?, 'APPROVED', CURRENT_TIMESTAMP, 0, ?, '', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(sheetId, request.title, subject, request.userId, id, request.courseId || '', request.academicYear || '',
          request.semester || '', normalizeTitle(request.title), request.fileHash || '')
      }
      if (!existing?.hasFile) {
        createSheetFile({
          sheetId,
          uploaderId: request.userId,
          originalFilename: file.fileName || request.fileName || 'download',
          mimeType: file.fileType || request.fileType || 'application/octet-stream',
          fileSize: request.fileSize,
          fileData: file.fileData
        })
      }

      db.prepare(`
        UPDATE upload_requests
        SET status = 'COMPLETED',
            decided_by = COALESCE(decided_by, ?),
            decided_at = COALESCE(NULLIF(decided_at, ''), CURRENT_TIMESTAMP),
            sheet_id = ?,
            file_data = NULL,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(adminId || null, sheetId, id)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

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
