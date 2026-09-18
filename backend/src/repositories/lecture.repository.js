import crypto from 'node:crypto'
import { db } from '../data/database.js'

function toLecture(row) {
  if (!row) return null
  const teachers = db.prepare(`SELECT display_name name FROM document_teachers WHERE document_type='Lecture' AND document_id=? ORDER BY display_name`).all(row.id)
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    instructor: row.instructor,
    description: row.description,
    programCode: row.program_code || '',
    programName: row.program_name_th || row.program_name_en || '',
    teachers,
    academicYear: row.academic_year,
    courseId: row.course_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    semester: row.semester,
    fileHash: row.file_hash,
    contentHash: row.content_hash,
    status: row.status,
    uploaderId: row.uploader_id,
    downloadCount: row.download_count,
    viewCount: row.view_count,
    fileName: row.file_name,
    sourceRequestId: row.source_request_id,
    uploaderUsername: row.uploader_username,
    hasFile: Boolean(row.has_file),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const lectureSelect = `
  SELECT
    lectures.id,
    lectures.title,
    lectures.subject,
    lectures.instructor,
    lectures.description,
    programs.code AS program_code, programs.name_th AS program_name_th, programs.name_en AS program_name_en,
    lectures.academic_year,
    lectures.course_id,
    courses.code AS course_code,
    courses.name AS course_name,
    lectures.semester,
    lectures.file_hash,
    lectures.content_hash,
    lectures.status,
    lectures.uploader_id,
    lectures.download_count,
    lectures.view_count,
    COALESCE(lecture_files.original_filename, lectures.file_name) AS file_name,
    lectures.source_request_id,
    lectures.created_at,
    lectures.updated_at,
    users.username AS uploader_username,
    CASE WHEN lecture_files.id IS NULL THEN 0 ELSE 1 END AS has_file
  FROM lectures
  LEFT JOIN users ON users.id = lectures.uploader_id
  LEFT JOIN courses ON courses.id = lectures.course_id
  LEFT JOIN programs ON programs.id = lectures.program_id
  LEFT JOIN lecture_files ON lecture_files.lecture_id = lectures.id
`

export function findAllLectures() {
  return db.prepare(`${lectureSelect} ORDER BY lectures.created_at DESC`).all().map(toLecture)
}

export function findApprovedLectures() {
  return db
    .prepare(`${lectureSelect} WHERE lectures.status = 'APPROVED' ORDER BY lectures.created_at DESC`)
    .all()
    .map(toLecture)
}

export function findLectureById(id) {
  return toLecture(db.prepare(`${lectureSelect} WHERE lectures.id = ?`).get(id))
}

export function createLecture({
  title,
  subject,
  instructor = '',
  description = '',
  academicYear = '',
  courseId = '',
  semester = '',
  fileHash = '',
  contentHash = '',
  uploaderId = '',
  fileName = '',
  sourceRequestId = null
}) {
  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO lectures (
      id, title, subject, instructor, description, academic_year,
      status, uploader_id, download_count, file_name, source_request_id, course_id,
      semester, normalized_title, file_hash, content_hash, view_count, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', ?, 0, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(id, title, subject, instructor, description, academicYear, uploaderId, fileName, sourceRequestId,
    courseId, semester, String(title).trim().toLowerCase().replace(/\s+/g, ' '), fileHash, contentHash)
  return findLectureById(id)
}

export function incrementLectureDownloadCount(id) {
  db.prepare('UPDATE lectures SET download_count = download_count + 1 WHERE id = ?').run(id)
}

export function countLectures() {
  return db.prepare('SELECT COUNT(*) AS count FROM lectures').get().count
}

export function countLecturesByStatus(status) {
  return db.prepare('SELECT COUNT(*) AS count FROM lectures WHERE status = ?').get(status).count
}
