import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'

const ENTITY_TABLES = ['courses', 'instructors', 'course_offerings']
const RELATIONSHIP_TABLES = ['program_courses', 'course_offering_teachers', 'course_offering_programs']
const AUTHORIZED_TABLES = ['programs', ...ENTITY_TABLES, ...RELATIONSHIP_TABLES]
const UNAUTHORIZED_TABLES = [
  'users', 'refresh_tokens', 'sheets', 'lectures', 'upload_requests', 'file_assets',
  'lecture_files', 'sheet_files', 'notifications', 'teacher_suggestions',
  'document_versions', 'upload_request_teachers', 'document_teachers',
  'document_stars', 'document_interactions', 'document_helpful_votes', 'course_imports'
]
const EXPECTED_SOURCE_COUNTS = {
  programs: 2,
  courses: 97,
  instructors: 27,
  program_courses: 100,
  course_offerings: 613,
  course_offering_teachers: 754,
  course_offering_programs: 613
}
const EXPECTED_TARGET_BEFORE = {
  programs: 2,
  courses: 0,
  instructors: 0,
  program_courses: 0,
  course_offerings: 0,
  course_offering_teachers: 0,
  course_offering_programs: 0
}

const args = process.argv.slice(2)
const sourcePath = args.find(argument => argument.startsWith('--source='))?.slice(9)
if (!sourcePath) throw new Error('Provide --source=<SQLite file>')
if (!args.includes('--apply-reference-data')) throw new Error('Explicit --apply-reference-data flag is required')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')

const source = new DatabaseSync(sourcePath, { readOnly: true })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 })
let client
let committed = false

const countsFor = async tables => Object.fromEntries(await Promise.all(tables.map(async table => [
  table,
  Number((await client.query(`SELECT COUNT(*) AS count FROM "${table}"`)).rows[0].count)
])))

const assertCounts = (label, actual, expected) => {
  for (const [table, count] of Object.entries(expected)) {
    if (actual[table] !== count) throw new Error(`${label} count changed for ${table}: expected ${count}, received ${actual[table]}`)
  }
}

const insertRows = async (table, rows) => {
  const columns = source.prepare(`PRAGMA table_info("${table}")`).all().map(column => column.name)
  const targetColumns = new Set((await client.query(
    'SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',
    ['public', table]
  )).rows.map(row => row.column_name))
  const missing = columns.filter(column => !targetColumns.has(column))
  if (missing.length) throw new Error(`Target schema cannot preserve ${table} columns: ${missing.join(', ')}`)
  const batchSize = 200
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize)
    const values = batch.flatMap(row => columns.map(column => row[column] instanceof Uint8Array ? Buffer.from(row[column]) : row[column]))
    const tuples = batch.map((_row, rowIndex) => `(${columns.map((_column, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`).join(',')})`)
    const sql = `INSERT INTO "${table}" (${columns.map(column => `"${column}"`).join(',')}) VALUES ${tuples.join(',')}`
    await client.query(sql, values)
  }
}

try {
  source.exec('BEGIN')
  const integrity = source.prepare('PRAGMA integrity_check').get().integrity_check
  const sourceForeignKeyViolations = source.prepare('PRAGMA foreign_key_check').all().length
  if (integrity !== 'ok') throw new Error('SQLite integrity check failed')
  if (sourceForeignKeyViolations) throw new Error(`Source has ${sourceForeignKeyViolations} foreign-key violations`)

  const sourceRows = Object.fromEntries(AUTHORIZED_TABLES.map(table => [table, source.prepare(`SELECT * FROM "${table}"`).all()]))
  const sourceCounts = Object.fromEntries(AUTHORIZED_TABLES.map(table => [table, sourceRows[table].length]))
  assertCounts('Source', sourceCounts, EXPECTED_SOURCE_COUNTS)

  client = await pool.connect()
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
  await client.query('SELECT pg_advisory_xact_lock($1)', [734619206])

  const targetBefore = await countsFor(AUTHORIZED_TABLES)
  assertCounts('Target pre-apply', targetBefore, EXPECTED_TARGET_BEFORE)
  const unauthorizedBefore = await countsFor(UNAUTHORIZED_TABLES)

  const targetPrograms = (await client.query('SELECT id,code,name_th,name_en FROM programs ORDER BY id')).rows
  const sourcePrograms = sourceRows.programs.map(row => ({ id: row.id, code: row.code, name_th: row.name_th, name_en: row.name_en })).sort((left, right) => left.id.localeCompare(right.id))
  if (JSON.stringify(targetPrograms) !== JSON.stringify(sourcePrograms)) throw new Error('Existing programs no longer exactly match the approved source rows')

  for (const table of ENTITY_TABLES) await insertRows(table, sourceRows[table])
  for (const table of RELATIONSHIP_TABLES) await insertRows(table, sourceRows[table])

  const targetAfter = await countsFor(AUTHORIZED_TABLES)
  assertCounts('Target post-apply', targetAfter, EXPECTED_SOURCE_COUNTS)
  const unauthorizedAfter = await countsFor(UNAUTHORIZED_TABLES)
  assertCounts('Unauthorized table', unauthorizedAfter, unauthorizedBefore)

  const checks = {
    orphanOfferings: Number((await client.query('SELECT COUNT(*) count FROM course_offerings o LEFT JOIN courses c ON c.id=o.course_id WHERE c.id IS NULL')).rows[0].count),
    orphanTeacherLinks: Number((await client.query('SELECT COUNT(*) count FROM course_offering_teachers l LEFT JOIN course_offerings o ON o.id=l.offering_id LEFT JOIN instructors i ON i.id=l.teacher_id WHERE o.id IS NULL OR i.id IS NULL')).rows[0].count),
    orphanProgramLinks: Number((await client.query('SELECT COUNT(*) count FROM course_offering_programs l LEFT JOIN course_offerings o ON o.id=l.offering_id LEFT JOIN programs p ON p.id=l.program_id WHERE o.id IS NULL OR p.id IS NULL')).rows[0].count),
    orphanProgramCourses: Number((await client.query('SELECT COUNT(*) count FROM program_courses l LEFT JOIN programs p ON p.id=l.program_id LEFT JOIN courses c ON c.id=l.course_id WHERE p.id IS NULL OR c.id IS NULL')).rows[0].count),
    duplicateCourseCodes: Number((await client.query("SELECT COUNT(*) count FROM (SELECT code FROM courses WHERE code<>'' GROUP BY code HAVING COUNT(*)>1) duplicates")).rows[0].count),
    duplicateInstructors: Number((await client.query("SELECT COUNT(*) count FROM (SELECT normalized_name FROM instructors GROUP BY normalized_name HAVING COUNT(*)>1) duplicates")).rows[0].count),
    duplicateOfferings: Number((await client.query('SELECT COUNT(*) count FROM (SELECT course_id,academic_year,semester,section FROM course_offerings GROUP BY course_id,academic_year,semester,section HAVING COUNT(*)>1) duplicates')).rows[0].count)
  }
  if (Object.values(checks).some(Boolean)) throw new Error(`Post-apply integrity check failed: ${JSON.stringify(checks)}`)

  const idChecks = {}
  for (const table of ['programs', ...ENTITY_TABLES]) {
    const sourceIds = new Set(sourceRows[table].map(row => row.id))
    const targetIds = new Set((await client.query(`SELECT id FROM "${table}"`)).rows.map(row => row.id))
    idChecks[table] = { missing: [...sourceIds].filter(id => !targetIds.has(id)).length, unexpected: [...targetIds].filter(id => !sourceIds.has(id)).length }
  }
  if (Object.values(idChecks).some(check => check.missing || check.unexpected)) throw new Error(`ID preservation check failed: ${JSON.stringify(idChecks)}`)

  await client.query('COMMIT')
  committed = true
  console.log(JSON.stringify({
    migration: 'PASS', transaction: 'COMMITTED', sourceCounts, targetBefore, targetAfter,
    inserted: Object.fromEntries(AUTHORIZED_TABLES.map(table => [table, table === 'programs' ? 0 : sourceCounts[table]])),
    reused: { programs: 2 }, updated: 0, idRemaps: 0, sourceForeignKeyViolations,
    checks, idChecks, unauthorizedBefore, unauthorizedAfter
  }, null, 2))
} catch (error) {
  if (client && !committed) {
    try { await client.query('ROLLBACK') } catch (rollbackError) { void rollbackError }
  }
  console.error(JSON.stringify({ migration: 'FAIL', transaction: 'ROLLED BACK', error: error.message }, null, 2))
  process.exitCode = 1
} finally {
  client?.release()
  await pool.end()
  source.close()
}
