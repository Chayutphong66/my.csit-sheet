import { db } from '../data/database.js'

function toLecture(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    instructor: row.instructor,
    description: row.description,
    academicYear: row.academic_year,
    status: row.status,
    createdAt: row.created_at
  }
}

export function findAllLectures() {
  return db.prepare('SELECT * FROM lectures ORDER BY created_at DESC').all().map(toLecture)
}

export function findApprovedLectures() {
  return db
    .prepare("SELECT * FROM lectures WHERE status = 'APPROVED' ORDER BY created_at DESC")
    .all()
    .map(toLecture)
}

export function findLectureById(id) {
  return toLecture(db.prepare('SELECT * FROM lectures WHERE id = ?').get(id))
}

export function countLectures() {
  return db.prepare('SELECT COUNT(*) AS count FROM lectures').get().count
}
