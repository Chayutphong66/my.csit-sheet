import crypto from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import readXlsxFile, { readSheetNames } from 'read-excel-file/node'
import { db } from './database.js'
import { normalizeTeacherName } from '../repositories/academic.repository.js'

const PERIOD_SHEET = /^(25\d{2})[_-]([123])$/
const COURSE_CELL = /^(\d{6,})\s*-\s*([A-Za-z0-9]+)\b/
const DEFAULT_REGISTRAR_DIRECTORY = fileURLToPath(new URL('../../data/registrar/', import.meta.url))
const clean = (value) => String(value?.text ?? value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ')

export function normalizeImportedTeacherName(value) {
  return clean(value).replace(/\s*\(\s*CLOSE\s*\)\s*/gi, ' ').replace(/\s+/g, ' ').trim()
}

const workbookInput = (source) => Buffer.isBuffer(source) || source instanceof Uint8Array ? Buffer.from(source) : source
const sourceBuffer = (source) => Buffer.isBuffer(source) || source instanceof Uint8Array ? Buffer.from(source) : readFileSync(source)

function isTeacherText(value) {
  const text = clean(value)
  if (!text || text.startsWith('(') || /^(หมายเหตุ|note|รวม|total)\b/i.test(text)) return false
  return /[ก-๙A-Za-z]/.test(text)
}

function finalizeRecord(record, records, errors, sheetName) {
  if (!record) return
  record.teachers = [...new Set(record.teachers.map(normalizeImportedTeacherName).filter(Boolean))]
  delete record.teacherColumn
  if (!record.code || !record.name || !record.section) {
    errors.push({ sheet: sheetName, row: record.sourceRow, message: 'Course code, name, or section is missing' })
    return
  }
  records.push(record)
}

export async function parseCourseWorkbook(source, programCode) {
  const input = workbookInput(source)
  const sheetNames = await readSheetNames(input)
  const records = []
  const errors = []
  const ignoredSheets = []
  for (const sheetName of sheetNames) {
    const period = PERIOD_SHEET.exec(clean(sheetName))
    if (!period) { ignoredSheets.push(sheetName); continue }
    const [, academicYear, semester] = period
    const rows = await readXlsxFile(input, { sheet: sheetName })
    let current = null
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]
      const courseColumn = row.findIndex((value) => COURSE_CELL.test(clean(value)))
      if (courseColumn >= 0) {
        finalizeRecord(current, records, errors, sheetName)
        const match = COURSE_CELL.exec(clean(row[courseColumn]))
        const sectionText = clean(row[courseColumn + 4])
        const creditsMatch = clean(row[courseColumn + 2]).match(/^\d+(?:\.\d+)?/)
        current = {
          program: String(programCode).toUpperCase(), academicYear, semester,
          code: match[1], name: clean(row[courseColumn + 1]),
          credits: creditsMatch ? Number(creditsMatch[0]) : null,
          section: sectionText.match(/^\d+/)?.[0] || match[2], teachers: [],
          sourceSheet: sheetName, sourceRow: rowIndex + 1, teacherColumn: courseColumn + 1
        }
        continue
      }
      if (current) {
        const possibleTeacher = clean(row[current.teacherColumn])
        if (isTeacherText(possibleTeacher)) current.teachers.push(possibleTeacher)
      }
    }
    finalizeRecord(current, records, errors, sheetName)
  }

  const unique = new Map()
  let duplicateRows = 0
  for (const record of records) {
    const key = `${record.code}\u0000${record.academicYear}\u0000${record.semester}\u0000${record.section}`
    const existing = unique.get(key)
    if (!existing) unique.set(key, record)
    else { existing.teachers = [...new Set([...existing.teachers, ...record.teachers])]; duplicateRows++ }
  }
  return { program: String(programCode).toUpperCase(), records: [...unique.values()], errors, duplicateRows, ignoredSheets, sheetCount: sheetNames.length - ignoredSheets.length }
}

function programFor(database, programCode) {
  const program = database.prepare('SELECT id,code,name_en nameEn FROM programs WHERE code=?').get(String(programCode).toUpperCase())
  if (!program) throw new Error(`Unknown program: ${programCode}`)
  return program
}

function buildPreview(parsed, database) {
  const program = programFor(database, parsed.program)
  const courseByCode = database.prepare('SELECT id,name,name_en,credits FROM courses WHERE code=?')
  const offeringByKey = database.prepare('SELECT id FROM course_offerings WHERE course_id=? AND academic_year=? AND semester=? AND section=?')
  const teacherByName = database.prepare('SELECT id FROM instructors WHERE normalized_name=?')
  const assignmentExists = database.prepare('SELECT 1 FROM course_offering_teachers WHERE offering_id=? AND teacher_id=?')
  const newCourses = new Set(), updatedCourses = new Set(), newTeachers = new Set()
  let newOfferings = 0, newTeacherAssignments = 0, existingRows = 0
  for (const record of parsed.records) {
    const course = courseByCode.get(record.code)
    if (!course) newCourses.add(record.code)
    else if (clean(course.name_en || course.name) !== record.name || (record.credits !== null && course.credits !== record.credits)) updatedCourses.add(record.code)
    const offering = course && offeringByKey.get(course.id, record.academicYear, record.semester, record.section)
    if (!offering) newOfferings++; else existingRows++
    for (const teacherName of record.teachers) {
      const normalized = normalizeTeacherName(teacherName)
      const teacher = teacherByName.get(normalized)
      if (!teacher) { newTeachers.add(normalized); newTeacherAssignments++ }
      else if (!offering || !assignmentExists.get(offering.id, teacher.id)) newTeacherAssignments++
    }
  }
  return {
    program: parsed.program, programName: program.nameEn, sheetCount: parsed.sheetCount,
    totalRows: parsed.records.length + parsed.duplicateRows + parsed.errors.length,
    validRows: parsed.records.length, newCourses: newCourses.size, updatedCourses: updatedCourses.size,
    newTeachers: newTeachers.size, newCourseOfferings: newOfferings, newTeacherAssignments,
    existingRows, skippedRows: parsed.duplicateRows, invalidRows: parsed.errors.length,
    errors: parsed.errors.slice(0, 100), ignoredSheets: parsed.ignoredSheets
  }
}

export async function previewCourseWorkbook(source, programCode, database = db) {
  return buildPreview(await parseCourseWorkbook(source, programCode), database)
}

function historyRow(database, id) {
  return database.prepare(`SELECT ci.id,ci.file_name fileName,ci.file_hash fileHash,p.code program,
    ci.imported_by_user_id importedByUserId,u.username importedByUsername,ci.imported_rows importedRows,
    ci.skipped_rows skippedRows,ci.error_rows errorRows,ci.status,ci.summary_json summaryJson,
    ci.error_message errorMessage,ci.imported_at importedAt FROM course_imports ci
    JOIN programs p ON p.id=ci.program_id LEFT JOIN users u ON u.id=ci.imported_by_user_id WHERE ci.id=?`).get(id)
}

export function listCourseImports(database = db) {
  return database.prepare(`SELECT ci.id,ci.file_name fileName,p.code program,u.username importedByUsername,
    ci.imported_rows importedRows,ci.skipped_rows skippedRows,ci.error_rows errorRows,ci.status,
    ci.error_message errorMessage,ci.imported_at importedAt FROM course_imports ci JOIN programs p ON p.id=ci.program_id
    LEFT JOIN users u ON u.id=ci.imported_by_user_id ORDER BY ci.imported_at DESC,ci.id DESC LIMIT 100`).all()
}

export async function importCourseWorkbook(source, programCode, database = db, options = {}) {
  if (typeof source === 'string' && !existsSync(source)) throw new Error(`Course data file not found: ${source}`)
  const program = programFor(database, programCode)
  const parsed = await parseCourseWorkbook(source, program.code)
  const preview = buildPreview(parsed, database)
  if (parsed.records.length === 0) throw new Error('No valid course offering rows were found in the workbook')
  const fileName = clean(options.fileName || (typeof source === 'string' ? path.basename(source) : 'course-import.xlsx'))
  const fileHash = crypto.createHash('sha256').update(sourceBuffer(source)).digest('hex')
  const historyId = crypto.randomUUID()
  const stats = { ...preview, importedRows: 0, createdCourses: 0, updatedCourses: 0, createdTeachers: 0, createdCourseOfferings: 0, createdTeacherAssignments: 0, removedTeacherAssignments: 0 }
  const findCourse = database.prepare('SELECT id,name,name_en,credits FROM courses WHERE code=?')
  const insertCourse = database.prepare('INSERT INTO courses(id,name,code,name_en,name_th,credits,description,updated_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)')
  const updateCourse = database.prepare("UPDATE courses SET name=?,name_en=?,credits=COALESCE(?,credits),description=CASE WHEN trim(description)='' THEN ? ELSE description END,updated_at=CURRENT_TIMESTAMP WHERE id=?")
  const mapCourse = database.prepare('INSERT OR IGNORE INTO program_courses(program_id,course_id) VALUES(?,?)')
  const findOffering = database.prepare('SELECT id FROM course_offerings WHERE course_id=? AND academic_year=? AND semester=? AND section=?')
  const insertOffering = database.prepare('INSERT INTO course_offerings(id,course_id,academic_year,semester,section,source_course_code,source_course_name) VALUES(?,?,?,?,?,?,?)')
  const updateOffering = database.prepare('UPDATE course_offerings SET source_course_code=?,source_course_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
  const mapOffering = database.prepare('INSERT OR IGNORE INTO course_offering_programs(offering_id,program_id) VALUES(?,?)')
  const findTeacher = database.prepare('SELECT id FROM instructors WHERE normalized_name=?')
  const insertTeacher = database.prepare("INSERT INTO instructors(id,name,email,active,normalized_name,created_at,updated_at) VALUES(?,?,'',1,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
  const mapTeacher = database.prepare('INSERT OR IGNORE INTO course_offering_teachers(offering_id,teacher_id) VALUES(?,?)')
  const currentAssignments = database.prepare('SELECT teacher_id FROM course_offering_teachers WHERE offering_id=?')
  const removeAssignment = database.prepare('DELETE FROM course_offering_teachers WHERE offering_id=? AND teacher_id=?')
  database.exec('BEGIN')
  try {
    for (const record of parsed.records) {
      let course = findCourse.get(record.code)
      if (!course) { course = { id: crypto.randomUUID() }; insertCourse.run(course.id, record.name, record.code, record.name, '', record.credits, record.name); stats.createdCourses++ }
      else if (clean(course.name_en || course.name) !== record.name || (record.credits !== null && course.credits !== record.credits)) { updateCourse.run(record.name, record.name, record.credits, record.name, course.id); stats.updatedCourses++ }
      mapCourse.run(program.id, course.id)
      let offering = findOffering.get(course.id, record.academicYear, record.semester, record.section)
      if (!offering) { offering = { id: crypto.randomUUID() }; insertOffering.run(offering.id, course.id, record.academicYear, record.semester, record.section, record.code, record.name); stats.createdCourseOfferings++ }
      else updateOffering.run(record.code, record.name, offering.id)
      mapOffering.run(offering.id, program.id)
      const importedTeacherIds = new Set()
      for (const teacherName of record.teachers) {
        const normalized = normalizeTeacherName(teacherName)
        if (!normalized) continue
        let teacher = findTeacher.get(normalized)
        if (!teacher) { teacher = { id: crypto.randomUUID() }; insertTeacher.run(teacher.id, teacherName, normalized); stats.createdTeachers++ }
        importedTeacherIds.add(teacher.id)
        stats.createdTeacherAssignments += Number(mapTeacher.run(offering.id, teacher.id).changes > 0)
      }
      if (options.destructiveSync === true) {
        for (const assignment of currentAssignments.all(offering.id)) if (!importedTeacherIds.has(assignment.teacher_id)) stats.removedTeacherAssignments += removeAssignment.run(offering.id, assignment.teacher_id).changes
      }
      stats.importedRows++
    }
    database.prepare(`INSERT INTO course_imports(id,file_name,file_hash,program_id,imported_by_user_id,imported_rows,skipped_rows,error_rows,status,summary_json)
      VALUES(?,?,?,?,?,?,?,?, 'COMPLETED',?)`).run(historyId, fileName, fileHash, program.id, options.importedByUserId || null, stats.importedRows, stats.skippedRows, stats.invalidRows, JSON.stringify(stats))
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    database.prepare(`INSERT INTO course_imports(id,file_name,file_hash,program_id,imported_by_user_id,imported_rows,skipped_rows,error_rows,status,summary_json,error_message)
      VALUES(?,?,?,?,?,0,?,?, 'FAILED',?,?)`).run(historyId, fileName, fileHash, program.id, options.importedByUserId || null, stats.skippedRows, stats.invalidRows, JSON.stringify(stats), String(error.message).slice(0, 1000))
    throw error
  }
  return { ...stats, history: historyRow(database, historyId) }
}

export async function importHistoricalCourseData({ directory = DEFAULT_REGISTRAR_DIRECTORY, database = db } = {}) {
  const results = []
  results.push(await importCourseWorkbook(path.join(directory, 'DataCourseCS.xlsx'), 'CS', database))
  results.push(await importCourseWorkbook(path.join(directory, 'DataCourseIT.xlsx'), 'IT', database))
  return results
}

export function courseImportToken(buffer, programCode) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).update(':').update(String(programCode).toUpperCase()).digest('hex')
}
