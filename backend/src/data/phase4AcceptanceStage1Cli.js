import crypto from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'

const productionUrl = 'https://mycsit-sheet-production.up.railway.app'
const suffix = `${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`
const password = `P4!${crypto.randomBytes(18).toString('base64url')}`
const statePath = path.join(os.tmpdir(), 'csit-sheet-phase4-acceptance.json')
const accounts = {
  user: { username: `phase4_verify_user_${suffix}`, email: `phase4_verify_user_${suffix}@example.invalid`, displayName: 'Phase 4 Verification User', password, program: 'CS', cohort: '69' },
  admin: { username: `phase4_verify_admin_${suffix}`, email: `phase4_verify_admin_${suffix}@example.invalid`, displayName: 'Phase 4 Verification Admin', password, program: 'IT', cohort: '69' }
}

const call = async (route, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${productionUrl}${route}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await response.text()
  let data
  try { data = text ? JSON.parse(text) : null } catch { data = { message: text.slice(0, 300) } }
  return { status: response.status, ok: response.ok, data, requestId: response.headers.get('x-request-id') }
}

const state = { productionUrl, createdAt: new Date().toISOString(), accounts }
const persist = () => writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 })

for (const [kind, account] of Object.entries(accounts)) {
  const registered = await call('/api/auth/register', { method: 'POST', body: account })
  if (registered.status !== 201) throw new Error(`${kind} registration failed with HTTP ${registered.status}: ${registered.data?.message || 'unknown error'}`)
}
await persist()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 })
const client = await pool.connect()
let fixtures
try {
  await client.query('BEGIN')
  const created = (await client.query('SELECT id,username,email,role,password FROM users WHERE username=ANY($1) ORDER BY username', [[accounts.user.username, accounts.admin.username]])).rows
  if (created.length !== 2 || created.some(row => !String(row.password).startsWith('scrypt$'))) throw new Error('Disposable accounts were not created through the expected hashed-password flow')
  const userRow = created.find(row => row.username === accounts.user.username)
  const adminRow = created.find(row => row.username === accounts.admin.username)
  if (!userRow || !adminRow || userRow.role !== 'USER' || adminRow.role !== 'USER') throw new Error('Disposable account pre-promotion state is invalid')
  const promoted = await client.query("UPDATE users SET role='ADMIN' WHERE id=$1 AND username=$2 AND role='USER' RETURNING id,role", [adminRow.id, adminRow.username])
  if (promoted.rowCount !== 1 || promoted.rows[0].role !== 'ADMIN') throw new Error('Disposable admin promotion failed')
  await client.query('COMMIT')
  state.accounts.user.id = userRow.id
  state.accounts.admin.id = adminRow.id

  await client.query('BEGIN TRANSACTION READ ONLY')
  const programSamples = (await client.query(`
    SELECT DISTINCT ON (p.code) p.id AS program_id,p.code AS program,c.id,c.code,c.name_en,o.academic_year,o.semester
    FROM programs p JOIN course_offering_programs op ON op.program_id=p.id
    JOIN course_offerings o ON o.id=op.offering_id JOIN courses c ON c.id=o.course_id
    ORDER BY p.code,o.academic_year,c.code
  `)).rows
  const periodSamples = (await client.query('SELECT DISTINCT academic_year,semester FROM course_offerings ORDER BY academic_year,semester')).rows
  const multiInstructor = (await client.query(`
    SELECT o.id AS offering_id,c.id AS course_id,c.code,c.name_en,o.academic_year,o.semester,o.section,
      op.program_id,p.code AS program,array_agg(i.name ORDER BY i.name) AS teachers,array_agg(i.id ORDER BY i.name) AS teacher_ids
    FROM course_offerings o JOIN courses c ON c.id=o.course_id
    JOIN course_offering_teachers ot ON ot.offering_id=o.id JOIN instructors i ON i.id=ot.teacher_id
    JOIN course_offering_programs op ON op.offering_id=o.id JOIN programs p ON p.id=op.program_id
    GROUP BY o.id,c.id,c.code,c.name_en,o.academic_year,o.semester,o.section,op.program_id,p.code
    HAVING COUNT(*)>1 ORDER BY COUNT(*) DESC,c.code LIMIT 1
  `)).rows[0]
  fixtures = { programSamples, periodSamples, multiInstructor }
  await client.query('ROLLBACK')
} catch (error) {
  try { await client.query('ROLLBACK') } catch (rollbackError) { void rollbackError }
  throw error
} finally {
  client.release()
  await pool.end()
}
await persist()

const sessions = {}
for (const kind of ['user', 'admin']) {
  const loggedIn = await call('/api/auth/login', { method: 'POST', body: { usernameOrEmail: accounts[kind].username, password } })
  if (loggedIn.status !== 200 || !loggedIn.data?.accessToken) throw new Error(`${kind} login failed with HTTP ${loggedIn.status}`)
  sessions[kind] = loggedIn.data
}
const userToken = sessions.user.accessToken
const adminToken = sessions.admin.accessToken

const checks = {
  disposableUser: sessions.user.user?.id === state.accounts.user.id && sessions.user.user?.role === 'USER',
  disposableAdmin: sessions.admin.user?.id === state.accounts.admin.id && sessions.admin.user?.role === 'ADMIN',
  userLogin: Boolean(userToken),
  adminAuthorization: false
}
const adminProbe = await call('/api/admin/upload-requests?status=PENDING', { token: adminToken })
checks.adminAuthorization = adminProbe.status === 200

const programsResponse = await call('/api/catalog/courses/programs', { token: userToken })
const listResponse = await call('/api/catalog/courses?limit=50', { token: userToken })
const periodsResponse = await call('/api/catalog/courses/periods', { token: userToken })
if (![programsResponse, listResponse, periodsResponse].every(response => response.status === 200)) throw new Error('Authenticated reference API bootstrap request failed')
checks.courseList = listResponse.data.courses.length > 0 && new Set(listResponse.data.courses.map(course => course.id)).size === listResponse.data.courses.length
checks.programCS = false
checks.programIT = false
checks.courseCodeSearch = true
checks.partialCourseCodeSearch = true
checks.courseNameSearch = true
const sampleResults = []
for (const sample of fixtures.programSamples) {
  const exact = await call(`/api/catalog/courses?q=${encodeURIComponent(sample.code)}&program=${sample.program}&year=${sample.academic_year}&semester=${sample.semester}`, { token: userToken })
  const partialTerm = sample.code.slice(0, Math.max(3, sample.code.length - 2))
  const partial = await call(`/api/catalog/courses?q=${encodeURIComponent(partialTerm)}&program=${sample.program}&year=${sample.academic_year}&semester=${sample.semester}`, { token: userToken })
  const byName = await call(`/api/catalog/courses?q=${encodeURIComponent(sample.name_en)}&program=${sample.program}&year=${sample.academic_year}&semester=${sample.semester}`, { token: userToken })
  const filtered = await call(`/api/catalog/courses?program=${sample.program}&year=${sample.academic_year}&semester=${sample.semester}&limit=50`, { token: userToken })
  const exactIds = exact.data?.courses?.map(course => course.id) || []
  const values = {
    program: sample.program, code: sample.code, name: sample.name_en, year: sample.academic_year, semester: sample.semester,
    exact: exact.status === 200 && exactIds.includes(sample.id) && new Set(exactIds).size === exactIds.length,
    partial: partial.status === 200 && partial.data.courses.some(course => course.id === sample.id),
    nameSearch: byName.status === 200 && byName.data.courses.some(course => course.id === sample.id),
    programFilter: filtered.status === 200 && filtered.data.courses.some(course => course.id === sample.id) && new Set(filtered.data.courses.map(course => course.id)).size === filtered.data.courses.length
  }
  sampleResults.push(values)
  checks[`program${sample.program}`] = values.programFilter
  checks.courseCodeSearch &&= values.exact
  checks.partialCourseCodeSearch &&= values.partial
  checks.courseNameSearch &&= values.nameSearch
}
const sourceYears = [...new Set(fixtures.periodSamples.map(row => row.academic_year))]
const sourceSemesters = [...new Set(fixtures.periodSamples.map(row => row.semester))]
checks.academicYears = sourceYears.length === 5 && sourceYears.every(year => periodsResponse.data.academicYears.includes(year))
checks.semesters = sourceSemesters.length === 2 && sourceSemesters.every(semester => periodsResponse.data.semesters.includes(semester))

const multi = fixtures.multiInstructor
if (!multi) throw new Error('No multi-instructor offering is available')
const teacherResponse = await call(`/api/catalog/courses/${multi.course_id}/teachers?year=${multi.academic_year}&semester=${multi.semester}&program=${multi.program}`, { token: userToken })
const returnedTeacherIds = new Set((teacherResponse.data?.teachers || []).map(teacher => teacher.id))
checks.instructorRelationships = teacherResponse.status === 200 && multi.teacher_ids.every(id => returnedTeacherIds.has(id))

state.referenceVerification = { checks, sampleResults, years: sourceYears, semesters: sourceSemesters, multiInstructor: { code: multi.code, year: multi.academic_year, semester: multi.semester, teachers: multi.teachers } }
await persist()
if (!Object.values(checks).every(Boolean)) throw new Error(`Authenticated reference verification failed: ${JSON.stringify(checks)}`)

const fileBytes = Buffer.from(`CSIT Sheet Phase 4 production acceptance ${suffix}\nSafe disposable verification document.\n`, 'utf8')
const uploadBody = {
  title: `Phase 4 verification ${suffix}`,
  description: 'Disposable Phase 4 production acceptance fixture',
  fileName: `phase4-verification-${suffix}.txt`, fileType: 'text/plain', fileSize: fileBytes.length,
  fileData: fileBytes.toString('base64'), courseId: multi.course_id, programId: multi.program_id,
  documentType: 'Sheet', academicYear: multi.academic_year, semester: multi.semester,
  instructorIds: multi.teacher_ids, suggestionIds: []
}
const upload = await call('/api/upload-requests', { method: 'POST', token: userToken, body: uploadBody })
state.upload = { status: upload.status, requestId: upload.requestId, id: upload.data?.id || null, expectedSha256: crypto.createHash('sha256').update(fileBytes).digest('hex'), fileName: uploadBody.fileName }
await persist()

const safeOutput = {
  statePath,
  accounts: { user: { id: state.accounts.user.id, username: accounts.user.username }, admin: { id: state.accounts.admin.id, username: accounts.admin.username } },
  referenceVerification: state.referenceVerification,
  upload: { status: upload.status, requestId: upload.requestId, id: upload.data?.id || null, message: upload.data?.message || null },
  stoppedAtStorageFailure: upload.status === 503
}
console.log(JSON.stringify(safeOutput, null, 2))
if (upload.status === 503) process.exitCode = 3
else if (upload.status !== 201) process.exitCode = 1
