import { db } from '../data/database.js'

const publicDocuments = `
  SELECT 'Lecture' AS document_type, lectures.id, lectures.title,
         lecture_files.original_filename AS file_name, lecture_files.mime_type,
         lectures.course_id, courses.code AS course_code, courses.name AS course_name,
         courses.description AS course_description, lectures.academic_year, lectures.semester,
         lectures.instructor, lectures.uploader_id, users.username AS uploader_username,
         COALESCE(NULLIF(users.display_name, ''), users.username) AS uploader_display_name,
         users.avatar_url AS uploader_avatar_url,
         lectures.view_count, lectures.download_count,
         (SELECT COUNT(*) FROM document_helpful_votes votes
          WHERE votes.document_type = 'Lecture' AND votes.document_id = lectures.id) AS helpful_count,
         lectures.created_at, lectures.updated_at
  FROM lectures
  JOIN lecture_files ON lecture_files.lecture_id = lectures.id
  JOIN courses ON courses.id = lectures.course_id
  LEFT JOIN users ON users.id = lectures.uploader_id
  WHERE lectures.status = 'APPROVED'
  UNION ALL
  SELECT 'Sheet', sheets.id, sheets.title, sheet_files.original_filename, sheet_files.mime_type,
         sheets.course_id, courses.code, courses.name, courses.description,
         sheets.academic_year, sheets.semester, upload_requests.instructor_name,
         sheets.uploader_id, users.username, COALESCE(NULLIF(users.display_name, ''), users.username), users.avatar_url,
         sheets.view_count, sheets.download_count,
         (SELECT COUNT(*) FROM document_helpful_votes votes
          WHERE votes.document_type = 'Sheet' AND votes.document_id = sheets.id),
         sheets.created_at, sheets.updated_at
  FROM sheets
  JOIN sheet_files ON sheet_files.sheet_id = sheets.id
  JOIN courses ON courses.id = sheets.course_id
  LEFT JOIN users ON users.id = sheets.uploader_id
  LEFT JOIN upload_requests ON upload_requests.id = sheets.source_request_id
  WHERE sheets.status = 'APPROVED'
`

function mapDocument(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    fileType: row.mime_type,
    documentType: row.document_type,
    courseId: row.course_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    courseDescription: row.course_description,
    academicYear: row.academic_year,
    semester: row.semester,
    instructor: row.instructor,
    uploaderUsername: row.uploader_username,
    uploaderDisplayName: row.uploader_display_name || row.uploader_username,
    uploaderAvatarUrl: row.uploader_avatar_url || '',
    uploaderId: row.uploader_id,
    viewCount: Number(row.view_count || 0),
    downloadCount: row.download_count,
    helpfulCount: Number(row.helpful_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasFile: true
  }
}

function addHelpfulByViewer(documents, viewerId = '') {
  if (!viewerId || !documents.length) return documents.map((document) => ({ ...document, helpfulByMe: false }))
  const votes = db.prepare(`
    SELECT document_type, document_id FROM document_helpful_votes WHERE user_id = ?
  `).all(viewerId)
  const keys = new Set(votes.map((vote) => `${vote.document_type}:${vote.document_id}`))
  return documents.map((document) => ({
    ...document,
    helpfulByMe: keys.has(`${document.documentType}:${document.id}`)
  }))
}

export function listCourseSummaries(documentType = '') {
  const rows = db.prepare(`
    SELECT courses.id, courses.code, courses.name, courses.description,
           COUNT(documents.id) AS document_count
    FROM courses
    LEFT JOIN (${publicDocuments}) documents
      ON documents.course_id = courses.id AND (? = '' OR documents.document_type = ?)
    GROUP BY courses.id, courses.code, courses.name, courses.description
    ORDER BY courses.code, courses.name
  `).all(documentType, documentType).map((row) => ({
    id: row.id, code: row.code, name: row.name, description: row.description,
    documentCount: Number(row.document_count)
  }))
  return documentType ? rows.filter((course) => course.documentCount > 0) : rows
}

export function findCourseSummary(id, documentType = '') {
  return listCourseSummaries(documentType).find((course) => course.id === id) ?? null
}

export function listCourseYears(courseId, documentType = '') {
  return db.prepare(`
    SELECT academic_year, COUNT(*) AS document_count
    FROM (${publicDocuments})
    WHERE course_id = ? AND academic_year != '' AND (? = '' OR document_type = ?)
    GROUP BY academic_year
    ORDER BY CAST(academic_year AS INTEGER) DESC, academic_year DESC
  `).all(courseId, documentType, documentType).map((row) => ({ academicYear: row.academic_year, documentCount: Number(row.document_count) }))
}

export function listCourseYearDocuments(courseId, academicYear, documentType = '', viewerId = '') {
  const documents = db.prepare(`
    SELECT * FROM (${publicDocuments})
    WHERE course_id = ? AND academic_year = ? AND semester != '' AND (? = '' OR document_type = ?)
    ORDER BY CAST(semester AS INTEGER), semester, created_at DESC
  `).all(courseId, academicYear, documentType, documentType).map(mapDocument)
  return addHelpfulByViewer(documents, viewerId)
}

export function searchDocuments(query, documentType = '', viewerId = '') {
  const term = `%${String(query ?? '').trim().toLowerCase()}%`
  const documents = db.prepare(`
    SELECT * FROM (${publicDocuments})
    WHERE (? = '' OR document_type = ?) AND (
      lower(title) LIKE ? OR lower(file_name) LIKE ? OR lower(course_code) LIKE ?
       OR lower(course_name) LIKE ? OR lower(academic_year) LIKE ? OR lower(semester) LIKE ?)
    ORDER BY created_at DESC LIMIT 100
  `).all(documentType, documentType, term, term, term, term, term, term).map(mapDocument)
  return addHelpfulByViewer(documents, viewerId)
}

export function findPublicDocument(type, id, viewerId = '') {
  const normalized = String(type).toLowerCase()
  const documentType = normalized === 'lecture' ? 'Lecture' : normalized === 'sheet' ? 'Sheet' : ''
  if (!documentType) return null
  const document = mapDocument(db.prepare(`SELECT * FROM (${publicDocuments}) WHERE document_type = ? AND id = ?`).get(documentType, id))
  return document ? addHelpfulByViewer([document], viewerId)[0] : null
}

export function listPublicDocumentsByUploaderId(uploaderId, viewerId = '', limit = 12) {
  const documents = db.prepare(`
    SELECT * FROM (${publicDocuments})
    WHERE uploader_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(uploaderId, Math.min(Math.max(Number(limit) || 12, 1), 50)).map(mapDocument)
  return addHelpfulByViewer(documents, viewerId)
}
