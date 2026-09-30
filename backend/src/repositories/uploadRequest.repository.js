import crypto from 'node:crypto'
import { db } from '../data/database.js'
import { createLecture } from './lecture.repository.js'
import { createLectureFile, lectureHasFile } from './lectureFile.repository.js'
import { createSheetFile, sheetHasFile } from './sheetFile.repository.js'
import { getOrCreateFileAsset } from './fileAsset.repository.js'
import { calculateContentFingerprint } from '../services/contentFingerprint.service.js'
import { ensureInitialVersion } from './documentVersion.repository.js'
import {
  calculateContributionScore,
  contributionBadges,
  contributorLevel
} from '../services/contributionScore.service.js'

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
    upload_requests.id, upload_requests.user_id, upload_requests.lecture_id, upload_requests.sheet_id,
    upload_requests.title, upload_requests.description, upload_requests.program_id, upload_requests.file_name, upload_requests.file_size, upload_requests.file_type,
    upload_requests.course_id, upload_requests.course_name, upload_requests.document_type,
    upload_requests.academic_year, upload_requests.semester, upload_requests.upload_date,
    upload_requests.instructor_id, upload_requests.instructor_name, upload_requests.course_offering_id, upload_requests.status,
    upload_requests.duplicate_status, upload_requests.rejection_type, upload_requests.file_hash,
    upload_requests.content_hash, upload_requests.file_asset_id, upload_requests.rejection_reason,
    upload_requests.decided_by, upload_requests.decided_at, upload_requests.created_at,
    upload_requests.updated_at, upload_requests.completed_at,
      users.username AS username,
      COALESCE(NULLIF(users.display_name, ''), users.username) AS display_name,
      users.avatar_url AS avatar_url,
      users.program_code AS contributor_program,
      users.cohort AS contributor_cohort,
    users.email AS email,
    admin.username AS decided_by_username,
    programs.code AS program_code, programs.name_th AS program_name_th, programs.name_en AS program_name_en,
    CASE WHEN upload_requests.status = 'COMPLETED' THEN 0
         WHEN upload_requests.file_asset_id IS NOT NULL OR upload_requests.file_data IS NOT NULL THEN 1 ELSE 0 END AS has_file
  FROM upload_requests
  JOIN users ON users.id = upload_requests.user_id
  LEFT JOIN users admin ON admin.id = upload_requests.decided_by
  LEFT JOIN programs ON programs.id = upload_requests.program_id
`

function toUploadRequest(row) {
  if (!row) return null
  const teachers = db.prepare(`SELECT instructors.id,instructors.name FROM upload_request_teachers link JOIN instructors ON instructors.id=link.teacher_id WHERE link.upload_request_id=? ORDER BY instructors.name`).all(row.id)
  const teacherSuggestions = db.prepare(`SELECT id,teacher_name teacherName,suggestion_type suggestionType,note,status,approval_scope approvalScope FROM teacher_suggestions WHERE upload_request_id=? ORDER BY created_at`).all(row.id)
  return {
    id: row.id,
    userId: row.user_id,
      username: row.username,
      displayName: row.display_name || row.username,
      avatarUrl: row.avatar_url || '',
      contributorProgram: row.contributor_program || '',
      contributorCohort: row.contributor_cohort || '',
    email: row.email,
    lectureId: row.lecture_id,
    sheetId: row.sheet_id,
    title: row.title,
    description: row.description || '',
    programId: row.program_id || null,
    programCode: row.program_code || '',
    programName: row.program_name_th || row.program_name_en || '',
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
    teachers,
    teacherSuggestions,
    courseOfferingId: row.course_offering_id,
    status: row.status,
    duplicateStatus: row.duplicate_status || 'NONE',
    rejectionType: row.rejection_type || 'STANDARD',
    fileHash: row.file_hash,
    contentHash: row.content_hash || '',
    fileAssetId: row.file_asset_id,
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
  instructorId = '',
  instructorIds = null,
  courseOfferingId = null,
  programId = null,
  description = '',
  suggestionIds = []
}) {
  const course = courseId ? findCourseById(courseId) : null
  const teacherIds = [...new Set((instructorIds || (instructorId ? [instructorId] : [])).filter(Boolean))]
  const instructors = teacherIds.map(findInstructorById).filter(Boolean)
  const instructor = instructors[0] || null
  const id = crypto.randomUUID()
  const fileHash = fileData ? crypto.createHash('sha256').update(Buffer.from(fileData)).digest('hex') : ''
  const contentHash = fileData ? calculateContentFingerprint(fileData, fileType) : ''
  const normalizedTitle = normalizeTitle(title)
  const duplicateStatus = classifyDuplicate({
    fileHash, contentHash, courseId: course?.id ?? '', academicYear, semester, documentType, normalizedTitle
  })

  // sheet_id and decided_by are nullable foreign keys. They must be inserted as
  // NULL (not the '' column default) until a sheet is created / an admin decides,
  // because SQLite validates a non-NULL FK value against the parent table and an
  // empty string matches no row -> "FOREIGN KEY constraint failed".
  db.exec('BEGIN')
  try {
    const asset = fileData ? getOrCreateFileAsset({
      binaryHash: fileHash,
      contentHash,
      originalFilename: fileName,
      mimeType: fileType,
      fileData
    }) : null
    db.prepare(`
      INSERT INTO upload_requests (
        id, user_id, lecture_id, sheet_id, title, file_name, file_size, file_type, file_data, file_asset_id,
        course_id, course_name, document_type, academic_year, semester, upload_date, instructor_id, instructor_name, course_offering_id, program_id, description,
        file_hash, content_hash, normalized_title, duplicate_status, status, decided_by
      )
      VALUES (@id, @userId, NULL, NULL, @title, @fileName, @fileSize, @fileType, NULL, @assetId,
        @courseId, @courseName, @documentType, @academicYear, @semester, @uploadDate, @instructorId, @instructorName,
        @courseOfferingId, @programId, @description, @fileHash, @contentHash, @normalizedTitle, @duplicateStatus, 'PENDING', NULL)
    `).run({ id, userId, title, fileName, fileSize: Number(fileSize) || 0, fileType: fileType ?? '', assetId: asset?.id ?? null,
      courseId: course?.id ?? '', courseName: course?.name ?? '', documentType: normalizeDocumentType(documentType) ?? 'Sheet', academicYear,
      semester, uploadDate, instructorId: instructor?.id ?? '', instructorName: instructors.map(item => item.name).join(', '), courseOfferingId,
      programId, description, fileHash, contentHash, normalizedTitle, duplicateStatus })
    const addTeacher = db.prepare('INSERT OR IGNORE INTO upload_request_teachers(upload_request_id,teacher_id) VALUES(?,?)')
    for (const teacher of instructors) addTeacher.run(id, teacher.id)
    if (suggestionIds.length) {
      const attachSuggestion = db.prepare(`UPDATE teacher_suggestions SET upload_request_id=? WHERE id=? AND submitted_by_user_id=? AND status='PENDING' AND upload_request_id IS NULL AND course_id=? AND academic_year=? AND semester=?`)
      for (const suggestionId of suggestionIds) {
        const result = attachSuggestion.run(id, suggestionId, userId, course?.id || '', academicYear, semester)
        if (!result.changes) throw new Error('Invalid or unrelated teacher suggestion')
      }
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

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
      SUM(CASE WHEN status = 'COMPLETED' AND rejection_type != 'DUPLICATE'
        AND duplicate_status NOT IN ('EXACT_DUPLICATE', 'CONTENT_DUPLICATE') THEN 1 ELSE 0 END) AS rewarded_published,
      SUM(CASE WHEN status IN ('PENDING', 'PROCESSING', 'APPROVED') THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status IN ('REJECTED', 'FAILED') THEN 1 ELSE 0 END) AS rejected
    FROM upload_requests WHERE user_id = ?
  `).get(userId)
  const impact = db.prepare(`
    WITH owned_documents(document_type, id, view_count, download_count) AS (
      SELECT 'Lecture', id, view_count, download_count FROM lectures WHERE uploader_id = ? AND status = 'APPROVED'
      UNION ALL
      SELECT 'Sheet', id, view_count, download_count FROM sheets WHERE uploader_id = ? AND status = 'APPROVED'
    )
    SELECT COALESCE(SUM(view_count), 0) AS total_views,
           COALESCE(SUM(download_count), 0) AS total_downloads,
           (SELECT COUNT(*) FROM document_helpful_votes votes
            JOIN owned_documents documents ON documents.document_type = votes.document_type AND documents.id = votes.document_id
           ) AS helpful,
           (SELECT COUNT(*) FROM document_interactions interactions
            JOIN owned_documents documents ON documents.document_type = interactions.document_type AND documents.id = interactions.document_id
            WHERE interactions.interaction_type = 'DOWNLOAD'
           ) AS qualified_downloads
    FROM owned_documents
  `).get(userId, userId)
  const recentImpactRows = db.prepare(`
    SELECT lectures.source_request_id, 'Lecture' AS document_type, lectures.id AS document_id,
           lectures.view_count, lectures.download_count,
           (SELECT COUNT(*) FROM document_helpful_votes votes
            WHERE votes.document_type = 'Lecture' AND votes.document_id = lectures.id) AS helpful_count
    FROM lectures WHERE lectures.uploader_id = ? AND lectures.status = 'APPROVED'
    UNION ALL
    SELECT sheets.source_request_id, 'Sheet', sheets.id, sheets.view_count, sheets.download_count,
           (SELECT COUNT(*) FROM document_helpful_votes votes
            WHERE votes.document_type = 'Sheet' AND votes.document_id = sheets.id)
    FROM sheets WHERE sheets.uploader_id = ? AND sheets.status = 'APPROVED'
  `).all(userId, userId)
  const impactByRequest = new Map(recentImpactRows.map((row) => [row.source_request_id, row]))
  const published = Number(totals.rewarded_published || 0)
  const revisionTotals = db.prepare(`SELECT COUNT(*) accepted_revisions,COUNT(DISTINCT document_type || ':' || document_id) contributed_documents FROM document_versions WHERE submitted_by=? AND status='APPROVED' AND revision_type NOT IN ('INITIAL','RESTORE')`).get(userId)
  const acceptedRevisions = Number(revisionTotals.accepted_revisions || 0)
  const contributedDocuments = Number(revisionTotals.contributed_documents || 0)
  const qualifiedDownloads = Number(impact.qualified_downloads || 0)
  const helpful = Number(impact.helpful || 0)
  const contributionScore = calculateContributionScore({ published: published + acceptedRevisions, qualifiedDownloads, helpful })
  return {
    total: Number(totals.total || 0),
    lectures: Number(totals.lectures || 0),
    sheets: Number(totals.sheets || 0),
    published: Number(totals.published || 0),
    pending: Number(totals.pending || 0),
    rejected: Number(totals.rejected || 0),
    totalViews: Number(impact.total_views || 0),
    totalDownloads: Number(impact.total_downloads || 0),
    helpful,
    acceptedRevisions,
    contributions: published + acceptedRevisions,
    contributionScore,
    contributorLevel: contributorLevel(contributionScore),
    badges: contributionBadges({ published: published + acceptedRevisions, acceptedRevisions, contributedDocuments, qualifiedDownloads, helpful }),
    recent: findUploadRequestsByUserId(userId).slice(0, limit).map((request) => {
      const row = impactByRequest.get(request.id)
      return {
        ...request,
        publicDocumentId: row?.document_id ?? request.lectureId ?? request.sheetId ?? null,
        views: Number(row?.view_count || 0),
        downloads: Number(row?.download_count || 0),
        helpful: Number(row?.helpful_count || 0)
      }
    })
  }
}

export function findUploadRequestById(id) {
  return toUploadRequest(db.prepare(`${requestSelect} WHERE upload_requests.id = ?`).get(id))
}

export function findUploadRequestFileById(id) {
  const row = db
    .prepare(`
      SELECT upload_requests.file_name, upload_requests.file_type,
             COALESCE(file_assets.file_data, upload_requests.file_data) AS file_data,
             upload_requests.file_asset_id
      FROM upload_requests
      LEFT JOIN file_assets ON file_assets.id = upload_requests.file_asset_id
      WHERE upload_requests.id = ?
    `)
    .get(id)
  if (!row) return null
  return { fileName: row.file_name, fileType: row.file_type, fileData: row.file_data, fileAssetId: row.file_asset_id }
}

export function findAllUploadRequests(reviewStatus = '') {
  const normalized = String(reviewStatus || '').trim().toUpperCase()
  return db
    .prepare(`${requestSelect}
      WHERE @status = ''
        OR (@status = 'PENDING' AND upload_requests.status IN ('PENDING','PROCESSING','APPROVED'))
        OR (@status = 'APPROVED' AND upload_requests.status = 'COMPLETED')
        OR (@status = 'REJECTED' AND upload_requests.status IN ('REJECTED','FAILED'))
      ORDER BY COALESCE(upload_requests.decided_at, upload_requests.created_at) DESC`)
    .all({ status: normalized })
    .map(toUploadRequest)
}

export function findDuplicateMatches(requestOrId) {
  const request = typeof requestOrId === 'string' ? findUploadRequestById(requestOrId) : requestOrId
  if (!request) return []
  const type = normalizeDocumentType(request.documentType)
  const params = {
    id: request.id,
    hash: request.fileHash || '',
    contentHash: request.contentHash || '',
    courseId: request.courseId || '',
    year: request.academicYear || '',
    semester: request.semester || '',
    type,
    title: normalizeTitle(request.title)
  }
  const rows = db.prepare(`
    SELECT 'REQUEST' AS source, requests.id, requests.title, requests.file_name,
           requests.document_type, requests.status, requests.file_hash, requests.content_hash,
           requests.course_id, courses.code AS course_code, requests.course_name,
           requests.academic_year, requests.semester, requests.normalized_title,
           users.username AS contributor, requests.created_at AS occurred_at,
           NULL AS public_document_id
    FROM upload_requests requests
    JOIN users ON users.id = requests.user_id
    LEFT JOIN courses ON courses.id = requests.course_id
    WHERE requests.id != @id AND requests.status = 'PENDING'
      AND ((@hash != '' AND requests.file_hash = @hash) OR
        (@contentHash != '' AND requests.content_hash = @contentHash) OR
        (course_id = @courseId AND academic_year = @year AND semester = @semester
         AND document_type = @type AND normalized_title = @title))
    UNION ALL
    SELECT 'LECTURE', lectures.id, lectures.title, COALESCE(lecture_files.original_filename, lectures.file_name),
           'Lecture', lectures.status, lectures.file_hash, lectures.content_hash,
           lectures.course_id, courses.code, courses.name, lectures.academic_year, lectures.semester,
           lectures.normalized_title, users.username, lectures.created_at, lectures.id
    FROM lectures
    LEFT JOIN lecture_files ON lecture_files.lecture_id = lectures.id
    LEFT JOIN users ON users.id = lectures.uploader_id
    LEFT JOIN courses ON courses.id = lectures.course_id
    WHERE lectures.status = 'APPROVED'
      AND ((@hash != '' AND lectures.file_hash = @hash) OR
        (@contentHash != '' AND lectures.content_hash = @contentHash) OR
        (@type = 'Lecture' AND lectures.course_id = @courseId AND lectures.academic_year = @year
         AND lectures.semester = @semester AND lectures.normalized_title = @title))
    UNION ALL
    SELECT 'SHEET', sheets.id, sheets.title, COALESCE(sheet_files.original_filename, ''), 'Sheet', sheets.status,
           sheets.file_hash, sheets.content_hash, sheets.course_id, courses.code, courses.name,
           sheets.academic_year, sheets.semester, sheets.normalized_title, users.username, sheets.created_at, sheets.id
    FROM sheets
    LEFT JOIN sheet_files ON sheet_files.sheet_id = sheets.id
    LEFT JOIN users ON users.id = sheets.uploader_id
    LEFT JOIN courses ON courses.id = sheets.course_id
    WHERE sheets.status = 'APPROVED'
      AND ((@hash != '' AND sheets.file_hash = @hash) OR
        (@contentHash != '' AND sheets.content_hash = @contentHash) OR
        (@type = 'Sheet' AND sheets.course_id = @courseId AND sheets.academic_year = @year AND sheets.semester = @semester
         AND sheets.normalized_title = @title))
  `).all(params)
  return rows.map((row) => {
    const binaryMatch = Boolean(params.hash && row.file_hash === params.hash)
    const contentMatch = Boolean(params.contentHash && row.content_hash === params.contentHash)
    return {
      source: row.source,
      id: row.id,
      title: row.title,
      fileName: row.file_name,
      documentType: row.document_type,
      status: row.status,
      courseId: row.course_id,
      courseCode: row.course_code,
      courseName: row.course_name,
      academicYear: row.academic_year,
      semester: row.semester,
      contributor: row.contributor,
      occurredAt: row.occurred_at,
      publicDocumentId: row.public_document_id,
      binaryMatch,
      contentMatch,
      matchType: binaryMatch ? 'EXACT_DUPLICATE' : contentMatch ? 'CONTENT_DUPLICATE' : 'POSSIBLE_DUPLICATE'
    }
  })
}

function classifyDuplicate(candidate) {
  const matches = findDuplicateMatches({ id: '', title: candidate.normalizedTitle, fileHash: candidate.fileHash,
    contentHash: candidate.contentHash,
    courseId: candidate.courseId, academicYear: candidate.academicYear, semester: candidate.semester,
    documentType: candidate.documentType })
  if (matches.some((match) => match.matchType === 'EXACT_DUPLICATE')) return 'EXACT_DUPLICATE'
  if (matches.some((match) => match.matchType === 'CONTENT_DUPLICATE')) return 'CONTENT_DUPLICATE'
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
  const instructor = instructorId ? findInstructorById(instructorId) : null
  const offering = instructor ? db.prepare(`SELECT offerings.id FROM course_offerings offerings JOIN course_offering_teachers link ON link.offering_id=offerings.id WHERE offerings.course_id=? AND offerings.academic_year=? AND offerings.semester=? AND link.teacher_id=? LIMIT 1`).get(courseId, academicYear, semester, instructorId) : null
  const normalizedType = normalizeDocumentType(documentType)

  if (!course || !normalizedType || (instructorId && (!instructor || !offering))) return null

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
          course_offering_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .run(course.id, course.name, normalizedType, academicYear, semester, instructor?.id || '', instructor?.name || '', offering?.id || null, id)

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
            description: request.description || '',
            academicYear: request.academicYear || '',
            courseId: request.courseId || '',
            semester: request.semester || '',
            fileHash: request.fileHash || '',
            contentHash: request.contentHash || '',
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
          fileAssetId: file.fileAssetId,
          fileData: Buffer.alloc(0)
        })
      }
      ensureInitialVersion({
        documentType: 'Lecture', documentId: lecture.id, submittedBy: request.userId,
        originalFileName: file.fileName || request.fileName || 'download', mimeType: file.fileType || request.fileType || 'application/octet-stream',
        fileSize: request.fileSize, sha256: request.fileHash, fileAssetId: file.fileAssetId
      })
      db.prepare('UPDATE lectures SET instructor_id = ?, course_offering_id = ? WHERE id = ?')
        .run(request.instructorId || null, request.courseOfferingId || null, lecture.id)
      db.prepare('UPDATE lectures SET program_id=? WHERE id=?').run(request.programId, lecture.id)
      const copyLectureTeacher = db.prepare(`INSERT OR IGNORE INTO document_teachers(id,document_type,document_id,teacher_id,display_name) VALUES(?,'Lecture',?,?,?)`)
      for (const teacher of request.teachers) copyLectureTeacher.run(crypto.randomUUID(), lecture.id, teacher.id, teacher.name)
      const approvedLectureSuggestions = db.prepare(`SELECT id,teacher_name,existing_teacher_id FROM teacher_suggestions WHERE upload_request_id=? AND status='APPROVED'`).all(id)
      for (const suggestion of approvedLectureSuggestions) db.prepare(`INSERT OR IGNORE INTO document_teachers(id,document_type,document_id,teacher_id,display_name,source_suggestion_id) VALUES(?,'Lecture',?,?,?,?)`).run(crypto.randomUUID(), lecture.id, suggestion.existing_teacher_id, suggestion.teacher_name, suggestion.id)
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
            course_id, academic_year, semester, normalized_title, file_hash, content_hash, view_count, updated_at,
            instructor_id, course_offering_id, program_id, description
          ) VALUES (?, ?, ?, 'APPROVED', CURRENT_TIMESTAMP, 0, ?, '', ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, ?, ?, ?, ?)
        `).run(sheetId, request.title, subject, request.userId, id, request.courseId || '', request.academicYear || '',
          request.semester || '', normalizeTitle(request.title), request.fileHash || '', request.contentHash || '',
          request.instructorId || null, request.courseOfferingId || null, request.programId, request.description || '')
      }
      const copySheetTeacher = db.prepare(`INSERT OR IGNORE INTO document_teachers(id,document_type,document_id,teacher_id,display_name) VALUES(?,'Sheet',?,?,?)`)
      for (const teacher of request.teachers) copySheetTeacher.run(crypto.randomUUID(), sheetId, teacher.id, teacher.name)
      const approvedSheetSuggestions = db.prepare(`SELECT id,teacher_name,existing_teacher_id FROM teacher_suggestions WHERE upload_request_id=? AND status='APPROVED'`).all(id)
      for (const suggestion of approvedSheetSuggestions) db.prepare(`INSERT OR IGNORE INTO document_teachers(id,document_type,document_id,teacher_id,display_name,source_suggestion_id) VALUES(?,'Sheet',?,?,?,?)`).run(crypto.randomUUID(), sheetId, suggestion.existing_teacher_id, suggestion.teacher_name, suggestion.id)
      if (!existing?.hasFile) {
        createSheetFile({
          sheetId,
          uploaderId: request.userId,
          originalFilename: file.fileName || request.fileName || 'download',
          mimeType: file.fileType || request.fileType || 'application/octet-stream',
          fileSize: request.fileSize,
          fileAssetId: file.fileAssetId,
          fileData: Buffer.alloc(0)
        })
      }
      ensureInitialVersion({
        documentType: 'Sheet', documentId: sheetId, submittedBy: request.userId,
        originalFileName: file.fileName || request.fileName || 'download', mimeType: file.fileType || request.fileType || 'application/octet-stream',
        fileSize: request.fileSize, sha256: request.fileHash, fileAssetId: file.fileAssetId
      })

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
