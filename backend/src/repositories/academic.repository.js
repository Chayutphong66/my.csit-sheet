import crypto from 'node:crypto'
import { db } from '../data/database.js'

export function normalizeTeacherName(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('th-TH')
}

function mapCourse(row) {
  return row && { id: row.id, code: row.code, name: row.name_en || row.name, nameTh: row.name_th || '', nameEn: row.name_en || row.name, credits: row.credits, category: row.category || '', description: row.description || '' }
}
function mapTeacher(row) {
  return row && { id: row.id, name: row.name, email: row.email || '', active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at }
}
function mapOffering(row) {
  return row && { id: row.id, courseId: row.course_id, courseCode: row.course_code, courseName: row.course_name, academicYear: row.academic_year, semester: row.semester, section: row.section || '', teachers: row.teachers ? JSON.parse(row.teachers) : [] }
}
function mapSuggestion(row) {
  return row && { id: row.id, teacherName: row.teacher_name, courseId: row.course_id, courseCode: row.course_code, courseName: row.course_name, academicYear: row.academic_year, semester: row.semester, section: row.section || '', uploadRequestId: row.upload_request_id || null, existingTeacherId: row.existing_teacher_id || null, suggestionType: row.suggestion_type || 'NEW_TEACHER', note: row.note || '', approvalScope: row.approval_scope || '', submittedByUserId: row.submitted_by_user_id, submittedByUsername: row.submitted_by_username, status: row.status, rejectionReason: row.rejection_reason || '', createdAt: row.created_at, reviewedAt: row.reviewed_at, reviewedByUsername: row.reviewed_by_username }
}

export function listPrograms() {
  return db.prepare('SELECT id, code, name_th nameTh, name_en nameEn FROM programs ORDER BY code').all()
}

export function findProgram(value) {
  return db.prepare('SELECT id, code, name_th nameTh, name_en nameEn FROM programs WHERE id=? OR code=?').get(value, String(value || '').toUpperCase()) || null
}
export function inferProgramForCourse(courseId) {
  const rows = db.prepare(`SELECT programs.id,programs.code,programs.name_th nameTh,programs.name_en nameEn FROM programs JOIN program_courses pc ON pc.program_id=programs.id WHERE pc.course_id=? ORDER BY programs.code`).all(courseId)
  return rows.length === 1 ? rows[0] : null
}

export function listCurriculumCourses(search = '') {
  const term = `%${String(search).trim().toLocaleLowerCase()}%`
  return db.prepare(`SELECT * FROM courses WHERE ? = '%%' OR lower(code) LIKE ? OR lower(name) LIKE ? OR lower(name_th) LIKE ? OR lower(name_en) LIKE ? ORDER BY code`).all(term, term, term, term, term).map(mapCourse)
}
export function getCurriculumCourse(id) { return mapCourse(db.prepare('SELECT * FROM courses WHERE id = ?').get(id)) }

function fuzzyDistance(left, right) {
  const a = [...left]; const b = [...right]; let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) { const current = [i]; for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = current }
  return previous[b.length]
}

export function searchCourses({ query = '', program = '', academicYear = '', semester = '', limit = 20 } = {}) {
  const q = String(query).normalize('NFKC').trim().toLocaleLowerCase()
  const selectedProgram = findProgram(program)
  if (program && !selectedProgram) return []
  const rows = db.prepare(`
    SELECT DISTINCT courses.* FROM courses
    JOIN program_courses pc ON pc.course_id=courses.id
    LEFT JOIN course_offerings offerings ON offerings.course_id=courses.id
    LEFT JOIN course_offering_programs op ON op.offering_id=offerings.id
    WHERE (?='' OR pc.program_id=?)
      AND (?='' OR offerings.academic_year=?)
      AND (?='' OR offerings.semester=?)
      AND (?='' OR op.program_id IS NULL OR op.program_id=?)
  `).all(selectedProgram?.id || '', selectedProgram?.id || '', academicYear, academicYear, semester, semester, selectedProgram?.id || '', selectedProgram?.id || '')
  const scored = rows.map(row => {
    const code = String(row.code || '').toLocaleLowerCase(); const names = `${row.name_en || row.name} ${row.name_th || ''}`.toLocaleLowerCase()
    let score = q ? 100 : 50
    if (q) {
      if (code === q || names === q) score = 0
      else if (code.startsWith(q)) score = 5
      else if (names.split(/\s+/).some(word => word.startsWith(q))) score = 10
      else if (code.includes(q)) score = 20
      else if (names.includes(q)) score = 30
      else { const words = names.split(/\s+/); score = 60 + Math.min(...words.map(word => fuzzyDistance(q, word.slice(0, Math.max(q.length, 2))))) }
    }
    return { row, score }
  }).filter(item => !q || item.score < 64).sort((a, b) => a.score - b.score || String(a.row.code).localeCompare(String(b.row.code)))
  return scored.slice(0, Math.max(1, Math.min(Number(limit) || 20, 50))).map(item => mapCourse(item.row))
}

export function courseValidForContext(courseId, program, academicYear, semester) {
  const selectedProgram = findProgram(program)
  if (!selectedProgram) return null
  return db.prepare(`SELECT offerings.id FROM course_offerings offerings
    JOIN program_courses pc ON pc.course_id=offerings.course_id
    LEFT JOIN course_offering_programs op ON op.offering_id=offerings.id
    WHERE offerings.course_id=? AND pc.program_id=? AND offerings.academic_year=? AND offerings.semester=?
      AND (op.program_id IS NULL OR op.program_id=?) LIMIT 1`).get(courseId, selectedProgram.id, academicYear, semester, selectedProgram.id) || null
}
export function courseOfferedInPeriod(courseId, academicYear, semester) {
  return db.prepare('SELECT id FROM course_offerings WHERE course_id=? AND academic_year=? AND semester=? LIMIT 1').get(courseId, academicYear, semester) || null
}

export function listAcademicPeriods() {
  const years = new Set(db.prepare(`SELECT academic_year FROM course_offerings UNION SELECT academic_year FROM upload_requests WHERE academic_year != ''`).all().map(row => row.academic_year))
  const terms = new Set(db.prepare(`SELECT semester FROM course_offerings UNION SELECT semester FROM upload_requests WHERE semester != ''`).all().map(row => row.semester))
  const currentBE = new Date().getUTCFullYear() + 543
  for (let year = currentBE + 1; year >= currentBE - 5; year--) years.add(String(year))
  terms.add('1'); terms.add('2')
  return { academicYears: [...years].filter(year => /^25\d{2}$/.test(year)).sort((a, b) => Number(b) - Number(a)), semesters: [...terms].filter(term => ['1', '2', '3'].includes(term)).sort() }
}

export function listTeachers({ search = '', includeInactive = false } = {}) {
  const term = `%${String(search).trim().toLocaleLowerCase()}%`
  return db.prepare(`SELECT * FROM instructors WHERE (? OR active = 1) AND (? = '%%' OR lower(name) LIKE ? OR lower(email) LIKE ?) ORDER BY active DESC, name`).all(includeInactive ? 1 : 0, term, term, term).map(mapTeacher)
}
export function findTeacher(id) { return mapTeacher(db.prepare('SELECT * FROM instructors WHERE id = ?').get(id)) }
export function createTeacher({ name, email = '', active = true }) {
  const normalized = normalizeTeacherName(name)
  if (!normalized) return null
  if (db.prepare('SELECT 1 FROM instructors WHERE normalized_name=?').get(normalized)) return null
  const id = crypto.randomUUID()
  try { db.prepare(`INSERT INTO instructors(id, name, email, active, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(id, String(name).trim(), String(email).trim(), active ? 1 : 0, normalized) }
  catch (error) { if (String(error.message).includes('UNIQUE')) return null; throw error }
  return findTeacher(id)
}
export function updateTeacher(id, { name, email, active }) {
  const existing = findTeacher(id)
  if (!existing) return null
  const nextName = name === undefined ? existing.name : String(name).trim()
  const normalized = normalizeTeacherName(nextName)
  if (!normalized) return null
  if (db.prepare('SELECT 1 FROM instructors WHERE normalized_name=? AND id!=?').get(normalized, id)) return null
  try { db.prepare(`UPDATE instructors SET name = ?, email = ?, active = ?, normalized_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(nextName, email === undefined ? existing.email : String(email).trim(), active === undefined ? Number(existing.active) : active ? 1 : 0, normalized, id) }
  catch (error) { if (String(error.message).includes('UNIQUE')) return null; throw error }
  return findTeacher(id)
}
export function teacherOfferings(teacherId) {
  return db.prepare(`SELECT offerings.*, courses.code course_code, COALESCE(NULLIF(courses.name_en,''), courses.name) course_name FROM course_offerings offerings JOIN courses ON courses.id=offerings.course_id JOIN course_offering_teachers link ON link.offering_id=offerings.id WHERE link.teacher_id=? ORDER BY academic_year DESC, semester, courses.code`).all(teacherId).map(row => mapOffering({ ...row, teachers: '[]' }))
}

export function teachersForCourse(courseId, academicYear, semester, section, program = '') {
  const args = [courseId, academicYear, semester]
  let sectionSql = ''
  if (section !== undefined && section !== '') { sectionSql = ' AND offerings.section = ?'; args.push(section) }
  const selectedProgram = program ? findProgram(program) : null
  let programSql = ''
  if (selectedProgram) { programSql = ' AND (op.program_id IS NULL OR op.program_id=?)'; args.push(selectedProgram.id) }
  return db.prepare(`SELECT DISTINCT teachers.* FROM instructors teachers JOIN course_offering_teachers link ON link.teacher_id=teachers.id JOIN course_offerings offerings ON offerings.id=link.offering_id LEFT JOIN course_offering_programs op ON op.offering_id=offerings.id WHERE offerings.course_id=? AND offerings.academic_year=? AND offerings.semester=?${sectionSql}${programSql} AND teachers.active=1 ORDER BY teachers.name`).all(...args).map(mapTeacher)
}
export function findOfferingForTeacher(courseId, academicYear, semester, teacherId, program = '') {
  const selectedProgram = program ? findProgram(program) : null
  if (program && !selectedProgram) return null
  return db.prepare(`SELECT offerings.id FROM course_offerings offerings JOIN course_offering_teachers link ON link.offering_id=offerings.id LEFT JOIN course_offering_programs op ON op.offering_id=offerings.id WHERE offerings.course_id=? AND offerings.academic_year=? AND offerings.semester=? AND link.teacher_id=? AND (?='' OR op.program_id IS NULL OR op.program_id=?) ORDER BY CASE WHEN offerings.section='' THEN 0 ELSE 1 END, offerings.section LIMIT 1`).get(courseId, academicYear, semester, teacherId, selectedProgram?.id || '', selectedProgram?.id || '')
}

export function listOfferings() {
  const rows = db.prepare(`SELECT offerings.*, courses.code course_code, COALESCE(NULLIF(courses.name_en,''), courses.name) course_name FROM course_offerings offerings JOIN courses ON courses.id=offerings.course_id ORDER BY academic_year DESC, semester, courses.code, section`).all()
  const teacherRows = db.prepare(`SELECT link.offering_id, teachers.id, teachers.name FROM course_offering_teachers link JOIN instructors teachers ON teachers.id=link.teacher_id ORDER BY teachers.name`).all()
  const grouped = new Map()
  for (const teacher of teacherRows) { const list = grouped.get(teacher.offering_id) || []; list.push({ id: teacher.id, name: teacher.name }); grouped.set(teacher.offering_id, list) }
  return rows.map(row => mapOffering({ ...row, teachers: JSON.stringify(grouped.get(row.id) || []) }))
}
export function saveOffering({ courseId, academicYear, semester, section = '', teacherIds }) {
  const course = getCurriculumCourse(courseId)
  const teachers = [...new Set(teacherIds)].map(findTeacher)
  if (!course || teachers.some(teacher => !teacher)) return null
  const current = db.prepare('SELECT id FROM course_offerings WHERE course_id=? AND academic_year=? AND semester=? AND section=?').get(courseId, academicYear, semester, section)
  const id = current?.id || crypto.randomUUID()
  db.exec('BEGIN')
  try {
    if (!current) db.prepare('INSERT INTO course_offerings(id,course_id,academic_year,semester,section) VALUES(?,?,?,?,?)').run(id, courseId, academicYear, semester, section)
    else db.prepare('UPDATE course_offerings SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id)
    db.prepare('DELETE FROM course_offering_teachers WHERE offering_id=?').run(id)
    const add = db.prepare('INSERT INTO course_offering_teachers(offering_id,teacher_id) VALUES(?,?)')
    for (const teacherId of new Set(teacherIds)) add.run(id, teacherId)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return listOfferings().find(offering => offering.id === id)
}

export function createTeacherSuggestion({ teacherName, courseId, academicYear, semester, section = '', userId, note = '', uploadRequestId = null }) {
  const normalized = normalizeTeacherName(teacherName)
  if (!normalized || !getCurriculumCourse(courseId)) return null
  const id = crypto.randomUUID()
  const existing = db.prepare('SELECT id FROM instructors WHERE normalized_name=?').get(normalized)
  try { db.prepare(`INSERT INTO teacher_suggestions(id,teacher_name,normalized_name,course_id,academic_year,semester,section,submitted_by_user_id,upload_request_id,existing_teacher_id,suggestion_type,note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, String(teacherName).trim(), normalized, courseId, academicYear, semester, section, userId, uploadRequestId, existing?.id || null, existing ? 'EXISTING_TEACHER_NEW_ASSIGNMENT' : 'NEW_TEACHER', String(note).trim().slice(0, 1000)) }
  catch (error) { if (String(error.message).includes('UNIQUE')) return false; throw error }
  return findSuggestion(id)
}
const suggestionSelect = `SELECT suggestions.*, courses.code course_code, COALESCE(NULLIF(courses.name_en,''),courses.name) course_name, submitter.username submitted_by_username, reviewer.username reviewed_by_username FROM teacher_suggestions suggestions JOIN courses ON courses.id=suggestions.course_id JOIN users submitter ON submitter.id=suggestions.submitted_by_user_id LEFT JOIN users reviewer ON reviewer.id=suggestions.reviewed_by_user_id`
export function findSuggestion(id) { return mapSuggestion(db.prepare(`${suggestionSelect} WHERE suggestions.id=?`).get(id)) }
export function listTeacherSuggestions(status = '') { return db.prepare(`${suggestionSelect} WHERE (?='' OR suggestions.status=?) ORDER BY CASE suggestions.status WHEN 'PENDING' THEN 0 ELSE 1 END, suggestions.created_at DESC`).all(status, status).map(mapSuggestion) }
export function reviewTeacherSuggestion({ id, adminId, decision, approve, reason = '' }) {
  const suggestion = findSuggestion(id)
  if (!suggestion || suggestion.status !== 'PENDING') return null
  const mode = decision || (approve ? 'APPROVE_GLOBAL' : 'REJECT')
  db.exec('BEGIN')
  try {
    let teacherRow = suggestion.existingTeacherId ? { id: suggestion.existingTeacherId } : null
    if (mode === 'APPROVE_GLOBAL') {
      teacherRow ||= db.prepare('SELECT id FROM instructors WHERE normalized_name=?').get(normalizeTeacherName(suggestion.teacherName))
      if (!teacherRow) {
        const teacherId = crypto.randomUUID()
        db.prepare(`INSERT INTO instructors(id,name,email,active,normalized_name,created_at,updated_at) VALUES(?,?,'',1,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).run(teacherId, suggestion.teacherName, normalizeTeacherName(suggestion.teacherName))
        teacherRow = { id: teacherId }
      } else db.prepare('UPDATE instructors SET active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(teacherRow.id)
      let offering = db.prepare('SELECT id FROM course_offerings WHERE course_id=? AND academic_year=? AND semester=? AND section=?').get(suggestion.courseId, suggestion.academicYear, suggestion.semester, suggestion.section)
      if (!offering) { offering = { id: crypto.randomUUID() }; db.prepare('INSERT INTO course_offerings(id,course_id,academic_year,semester,section) VALUES(?,?,?,?,?)').run(offering.id, suggestion.courseId, suggestion.academicYear, suggestion.semester, suggestion.section) }
      db.prepare('INSERT OR IGNORE INTO course_offering_teachers(offering_id,teacher_id) VALUES(?,?)').run(offering.id, teacherRow.id)
    }
    if (mode === 'APPROVE_DOCUMENT' && !teacherRow) {
      teacherRow = db.prepare('SELECT id FROM instructors WHERE normalized_name=?').get(normalizeTeacherName(suggestion.teacherName)) || null
    }
    if (mode !== 'REJECT' && suggestion.uploadRequestId) {
      const request = db.prepare('SELECT lecture_id,sheet_id FROM upload_requests WHERE id=?').get(suggestion.uploadRequestId)
      const documentType = request?.lecture_id ? 'Lecture' : request?.sheet_id ? 'Sheet' : null
      const documentId = request?.lecture_id || request?.sheet_id
      if (documentType && documentId) db.prepare(`INSERT OR IGNORE INTO document_teachers(id,document_type,document_id,teacher_id,display_name,source_suggestion_id) VALUES(?,?,?,?,?,?)`).run(crypto.randomUUID(), documentType, documentId, teacherRow?.id || null, suggestion.teacherName, suggestion.id)
    }
    db.prepare(`UPDATE teacher_suggestions SET status=?, approval_scope=?, existing_teacher_id=COALESCE(existing_teacher_id,?), reviewed_at=CURRENT_TIMESTAMP, reviewed_by_user_id=?, rejection_reason=? WHERE id=?`).run(mode === 'REJECT' ? 'REJECTED' : 'APPROVED', mode, teacherRow?.id || null, adminId, mode === 'REJECT' ? reason : '', id)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return findSuggestion(id)
}
