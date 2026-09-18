import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import writeXlsxFile from 'write-excel-file/node'

process.env.NODE_ENV = 'test'
process.env.SKIP_DB_SEED = '1'
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'csit-import-db-')), 'test.sqlite')
const { db } = await import('../src/data/database.js')
const { importHistoricalCourseData, previewCourseWorkbook } = await import('../src/data/importCourseOfferings.js')
test.after(() => db.close())

const cell = value => ({ value })
async function workbook(filePath, teacher) {
  await writeXlsxFile([
    ['', 'รหัสวิชา', 'ชื่อรายวิชา', 'หน่วยกิต', 'เวลา', 'ข้อมูลรายวิชา'].map(cell),
    ['', '', '', '', '', 'กลุ่ม'].map(cell),
    ['', '254171 - 1', 'Fundamentals of Programming', '3 (2-2-5)', '', '1 (65/13)'].map(cell),
    ['', '', '( CS1 )', '', '', ''].map(cell),
    ['', '', teacher, '', '', ''].map(cell)
  ], { filePath, sheet: '2568_1' })
}

test('registrar Excel preview and import are idempotent and additive', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'csit-import-files-'))
  const csFile = path.join(directory, 'DataCourseCS.xlsx')
  const itFile = path.join(directory, 'DataCourseIT.xlsx')
  await workbook(csFile, 'Teacher One (CLOSE)')
  await workbook(itFile, 'Teacher One')

  const preview = await previewCourseWorkbook(csFile, 'CS', db)
  assert.equal(preview.validRows, 1)
  assert.equal(preview.newCourseOfferings, 1)
  assert.equal(preview.newTeachers, 1)

  await importHistoricalCourseData({ directory, database: db })
  await importHistoricalCourseData({ directory, database: db })
  const course = db.prepare("SELECT id FROM courses WHERE code='254171'").get()
  assert.ok(course)
  assert.equal(db.prepare('SELECT COUNT(*) count FROM courses WHERE code=?').get('254171').count, 1)
  assert.equal(db.prepare('SELECT COUNT(*) count FROM program_courses WHERE course_id=?').get(course.id).count, 2)
  assert.equal(db.prepare('SELECT COUNT(*) count FROM course_offerings WHERE course_id=?').get(course.id).count, 1)
  assert.equal(db.prepare('SELECT COUNT(*) count FROM course_offering_programs').get().count, 2)
  assert.equal(db.prepare('SELECT name FROM instructors').get().name, 'Teacher One')
  assert.equal(db.prepare('SELECT COUNT(*) count FROM course_offering_teachers').get().count, 1)
  assert.equal(db.prepare('SELECT COUNT(*) count FROM course_imports').get().count, 4)
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
})
