import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const data = JSON.parse(readFileSync(fileURLToPath(new URL('./nu-it-courses.json', import.meta.url)), 'utf8'))

export function seedCurriculum(db) {
  const find = db.prepare('SELECT id FROM courses WHERE code = ? OR name = ? LIMIT 1')
  const update = db.prepare(`UPDATE courses SET code = ?, name = ?, name_th = ?, name_en = ?, credits = ?, category = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
  const insert = db.prepare(`INSERT INTO courses(id, name, code, description, name_th, name_en, credits, category, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
  const mapToIt = db.prepare(`INSERT OR IGNORE INTO program_courses(program_id, course_id) VALUES('program-it', ?)`)
  db.exec('BEGIN')
  try {
    for (const course of data.courses) {
      const description = `${course.nameTh} · ${course.credits} หน่วยกิต`
      const current = find.get(course.code, course.nameEn)
      let courseId = current?.id
      if (current) update.run(course.code, course.nameEn, course.nameTh, course.nameEn, course.credits, course.category, description, current.id)
      else { courseId = crypto.randomUUID(); insert.run(courseId, course.nameEn, course.code, description, course.nameTh, course.nameEn, course.credits, course.category) }
      mapToIt.run(courseId)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return { count: data.courses.length, curriculum: data.curriculum, source: data.source }
}
