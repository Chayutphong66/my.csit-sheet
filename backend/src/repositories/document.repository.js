import { db } from '../data/databaseClient.js'

const publicDocuments = `
  SELECT 'Lecture' AS document_type, lectures.id, lectures.title,
         COALESCE((SELECT original_filename FROM document_versions WHERE id=lectures.current_version_id),lecture_files.original_filename) AS file_name,
         COALESCE((SELECT mime_type FROM document_versions WHERE id=lectures.current_version_id),lecture_files.mime_type) AS mime_type,
         lectures.course_id, courses.code AS course_code, courses.name AS course_name,
         courses.description AS course_description, lectures.academic_year, lectures.semester,
         COALESCE(NULLIF((SELECT group_concat(display_name, ', ') FROM document_teachers dt WHERE dt.document_type='Lecture' AND dt.document_id=lectures.id), ''), NULLIF(lectures.instructor,''), 'ยังไม่ทราบอาจารย์') AS instructor,
         programs.code AS program_code, COALESCE(programs.name_th, programs.name_en, '') AS program_name,
         lectures.uploader_id, users.username AS uploader_username,
         COALESCE(NULLIF(users.display_name, ''), users.username) AS uploader_display_name,
         users.avatar_url AS uploader_avatar_url,
         lectures.view_count, lectures.download_count,
         (SELECT COUNT(*) FROM document_helpful_votes votes
          WHERE votes.document_type = 'Lecture' AND votes.document_id = lectures.id) AS helpful_count,
         lectures.created_at, lectures.updated_at, lectures.description,
         lectures.current_version_id,
         COALESCE((SELECT version_number FROM document_versions WHERE id=lectures.current_version_id),1) AS current_version_number,
         (SELECT version_users.username FROM document_versions versions JOIN users version_users ON version_users.id=versions.submitted_by WHERE versions.id=lectures.current_version_id) AS current_contributor_username,
         (SELECT COALESCE(NULLIF(version_users.display_name,''),version_users.username) FROM document_versions versions JOIN users version_users ON version_users.id=versions.submitted_by WHERE versions.id=lectures.current_version_id) AS current_contributor_display_name,
         (SELECT version_users.avatar_url FROM document_versions versions JOIN users version_users ON version_users.id=versions.submitted_by WHERE versions.id=lectures.current_version_id) AS current_contributor_avatar_url
  FROM lectures
  JOIN lecture_files ON lecture_files.lecture_id = lectures.id
  JOIN courses ON courses.id = lectures.course_id
  LEFT JOIN programs ON programs.id = lectures.program_id
  LEFT JOIN users ON users.id = lectures.uploader_id
  WHERE lectures.status = 'APPROVED'
  UNION ALL
  SELECT 'Sheet', sheets.id, sheets.title,
         COALESCE((SELECT original_filename FROM document_versions WHERE id=sheets.current_version_id),sheet_files.original_filename),
         COALESCE((SELECT mime_type FROM document_versions WHERE id=sheets.current_version_id),sheet_files.mime_type),
         sheets.course_id, courses.code, courses.name, courses.description,
         sheets.academic_year, sheets.semester,
         COALESCE(NULLIF((SELECT group_concat(display_name, ', ') FROM document_teachers dt WHERE dt.document_type='Sheet' AND dt.document_id=sheets.id), ''), 'ยังไม่ทราบอาจารย์'),
         programs.code, COALESCE(programs.name_th, programs.name_en, ''),
         sheets.uploader_id, users.username, COALESCE(NULLIF(users.display_name, ''), users.username), users.avatar_url,
         sheets.view_count, sheets.download_count,
         (SELECT COUNT(*) FROM document_helpful_votes votes
          WHERE votes.document_type = 'Sheet' AND votes.document_id = sheets.id),
         sheets.created_at, sheets.updated_at, sheets.description,
         sheets.current_version_id,
         COALESCE((SELECT version_number FROM document_versions WHERE id=sheets.current_version_id),1),
         (SELECT version_users.username FROM document_versions versions JOIN users version_users ON version_users.id=versions.submitted_by WHERE versions.id=sheets.current_version_id),
         (SELECT COALESCE(NULLIF(version_users.display_name,''),version_users.username) FROM document_versions versions JOIN users version_users ON version_users.id=versions.submitted_by WHERE versions.id=sheets.current_version_id),
         (SELECT version_users.avatar_url FROM document_versions versions JOIN users version_users ON version_users.id=versions.submitted_by WHERE versions.id=sheets.current_version_id)
  FROM sheets
  JOIN sheet_files ON sheet_files.sheet_id = sheets.id
  JOIN courses ON courses.id = sheets.course_id
  LEFT JOIN programs ON programs.id = sheets.program_id
  LEFT JOIN users ON users.id = sheets.uploader_id
  LEFT JOIN upload_requests ON upload_requests.id = sheets.source_request_id
  WHERE sheets.status = 'APPROVED'
`

function mapDocument(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
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
    programCode: row.program_code || '',
    programName: row.program_name || '',
    uploaderUsername: row.uploader_username,
    uploaderDisplayName: row.uploader_display_name || row.uploader_username,
    uploaderAvatarUrl: row.uploader_avatar_url || '',
    uploaderId: row.uploader_id,
    viewCount: Number(row.view_count || 0),
    downloadCount: row.download_count,
    helpfulCount: Number(row.helpful_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentVersionId: row.current_version_id || null,
    currentVersionNumber: Number(row.current_version_number || 1),
    currentContributorUsername: row.current_contributor_username || row.uploader_username,
    currentContributorDisplayName: row.current_contributor_display_name || row.uploader_display_name || row.uploader_username,
    currentContributorAvatarUrl: row.current_contributor_avatar_url || row.uploader_avatar_url || '',
    hasFile: true
  }
}

async function addHelpfulByViewer(documents, viewerId = '') {
  if (!viewerId || !documents.length) return documents.map((document) => ({ ...document, helpfulByMe: false }))
  const votes = await db.prepare(`
    SELECT document_type, document_id FROM document_helpful_votes WHERE user_id = ?
  `).all(viewerId)
  const keys = new Set(votes.map((vote) => `${vote.document_type}:${vote.document_id}`))
  return documents.map((document) => ({
    ...document,
    helpfulByMe: keys.has(`${document.documentType}:${document.id}`)
  }))
}

export async function listCourseSummaries(documentType = '') {
  const rows = (await db.prepare(`
    SELECT courses.id, courses.code, courses.name, courses.description,
           COUNT(documents.id) AS document_count
    FROM courses
    LEFT JOIN (${publicDocuments}) documents
      ON documents.course_id = courses.id AND (? = '' OR documents.document_type = ?)
    GROUP BY courses.id, courses.code, courses.name, courses.description
    ORDER BY courses.code, courses.name
  `).all(documentType, documentType)).map((row) => ({
    id: row.id, code: row.code, name: row.name, description: row.description,
    documentCount: Number(row.document_count)
  }))
  return documentType ? rows.filter((course) => course.documentCount > 0) : rows
}

export async function findCourseSummary(id, documentType = '') {
  return (await listCourseSummaries(documentType)).find((course) => course.id === id) ?? null
}

export async function listCourseYears(courseId, documentType = '') {
  return (await db.prepare(`
    SELECT academic_year, COUNT(*) AS document_count
    FROM (${publicDocuments})
    WHERE course_id = ? AND academic_year != '' AND (? = '' OR document_type = ?)
    GROUP BY academic_year
    ORDER BY CAST(academic_year AS INTEGER) DESC, academic_year DESC
  `).all(courseId, documentType, documentType)).map((row) => ({ academicYear: row.academic_year, documentCount: Number(row.document_count) }))
}

export async function listCourseYearDocuments(courseId, academicYear, documentType = '', viewerId = '') {
  const documents = (await db.prepare(`
    SELECT * FROM (${publicDocuments})
    WHERE course_id = ? AND academic_year = ? AND semester != '' AND (? = '' OR document_type = ?)
    ORDER BY CAST(semester AS INTEGER), semester, created_at DESC
  `).all(courseId, academicYear, documentType, documentType)).map(mapDocument)
  return await addHelpfulByViewer(documents, viewerId)
}

export async function searchDocuments(query, documentType = '', viewerId = '') {
  const term = `%${String(query ?? '').trim().toLowerCase()}%`
  const documents = (await db.prepare(`
    SELECT * FROM (${publicDocuments})
    WHERE (? = '' OR document_type = ?) AND (
      lower(title) LIKE ? OR lower(file_name) LIKE ? OR lower(course_code) LIKE ?
       OR lower(course_name) LIKE ? OR lower(description) LIKE ? OR lower(academic_year) LIKE ? OR lower(semester) LIKE ? OR lower(instructor) LIKE ?)
    ORDER BY created_at DESC LIMIT 100
  `).all(documentType, documentType, term, term, term, term, term, term, term, term)).map(mapDocument)
  return await addHelpfulByViewer(documents, viewerId)
}

export async function findPublicDocument(type, id, viewerId = '') {
  const normalized = String(type).toLowerCase()
  const documentType = normalized === 'lecture' ? 'Lecture' : normalized === 'sheet' ? 'Sheet' : ''
  if (!documentType) return null
  const document = mapDocument(await db.prepare(`SELECT * FROM (${publicDocuments}) WHERE document_type = ? AND id = ?`).get(documentType, id))
  return document ? (await addHelpfulByViewer([document], viewerId))[0] : null
}

export async function listPublicDocumentsByUploaderId(uploaderId, viewerId = '', limit = 12) {
  const documents = (await db.prepare(`
    SELECT * FROM (${publicDocuments})
    WHERE uploader_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(uploaderId, Math.min(Math.max(Number(limit) || 12, 1), 50))).map(mapDocument)
  return await addHelpfulByViewer(documents, viewerId)
}

export async function listProfileDocuments(uploaderId, viewerId) {
  return await addHelpfulByViewer((await db.prepare(`SELECT * FROM (${publicDocuments}) WHERE uploader_id = ? ORDER BY updated_at DESC`).all(uploaderId)).map(mapDocument), viewerId)
}

export async function listStarredPublicDocuments(userId, viewerId) {
  const rows = await db.prepare(`SELECT documents.*, stars.created_at AS starred_at FROM (${publicDocuments}) documents JOIN document_stars stars ON stars.document_type = documents.document_type AND stars.document_id = documents.id WHERE stars.user_id = ? ORDER BY stars.created_at DESC`).all(userId)
  return await addHelpfulByViewer(rows.map(row => ({ ...mapDocument(row), starredAt: row.starred_at })), viewerId)
}
