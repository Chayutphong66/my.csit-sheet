import jwt from 'jsonwebtoken'
import pg from 'pg'

const productionUrl = process.argv.find(argument => argument.startsWith('--url='))?.slice(6)?.replace(/\/$/, '')
if (!productionUrl) throw new Error('Provide --url=<production URL>')
if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('DATABASE_URL and JWT_SECRET are required')

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 })
const client = await pool.connect()
let fixtures
try {
  await client.query('BEGIN TRANSACTION READ ONLY')
  const user = (await client.query("SELECT id,role FROM users WHERE role='USER' ORDER BY id LIMIT 1")).rows[0]
  if (!user) throw new Error('No existing USER account is available for authenticated read-only API verification')
  const programSamples = (await client.query(`
    SELECT DISTINCT ON (p.code) p.code AS program,c.id,c.code,c.name_en,c.name_th,o.academic_year,o.semester,o.section
    FROM programs p JOIN course_offering_programs op ON op.program_id=p.id
    JOIN course_offerings o ON o.id=op.offering_id JOIN courses c ON c.id=o.course_id
    ORDER BY p.code,o.academic_year,c.code
  `)).rows
  const periodSamples = (await client.query(`
    SELECT DISTINCT ON (o.academic_year,o.semester) c.id,c.code,c.name_en,o.academic_year,o.semester
    FROM course_offerings o JOIN courses c ON c.id=o.course_id
    ORDER BY o.academic_year,o.semester,c.code
  `)).rows
  const multiInstructor = (await client.query(`
    SELECT o.id,c.id AS course_id,c.code,c.name_en,o.academic_year,o.semester,o.section,
      array_agg(i.name ORDER BY i.name) AS teachers,array_agg(i.id ORDER BY i.name) AS teacher_ids
    FROM course_offerings o JOIN courses c ON c.id=o.course_id
    JOIN course_offering_teachers ot ON ot.offering_id=o.id JOIN instructors i ON i.id=ot.teacher_id
    GROUP BY o.id,c.id,c.code,c.name_en,o.academic_year,o.semester,o.section
    HAVING COUNT(*)>1 ORDER BY COUNT(*) DESC,c.code LIMIT 1
  `)).rows[0]
  fixtures = { user, programSamples, periodSamples, multiInstructor }
  await client.query('ROLLBACK')
} finally {
  client.release()
  await pool.end()
}

const token = jwt.sign({ sub: fixtures.user.id, role: fixtures.user.role }, process.env.JWT_SECRET, {
  expiresIn: '10m', issuer: 'csit-sheet-api', audience: 'csit-sheet-client'
})
const request = async path => {
  const response = await fetch(`${productionUrl}${path}`, { headers: { authorization: `Bearer ${token}` } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`)
  return { status: response.status, body }
}
const result = { url: productionUrl, checks: {}, samples: {} }

const healthResponse = await fetch(`${productionUrl}/api/health`)
result.health = { status: healthResponse.status, body: await healthResponse.json().catch(() => null) }
result.checks.health = healthResponse.status === 200 && result.health.body?.status === 'ok'

const programs = await request('/api/catalog/courses/programs')
result.checks.programs = programs.body?.programs?.length === 2 && ['CS', 'IT'].every(code => programs.body.programs.some(program => program.code === code))

const list = await request('/api/catalog/courses?limit=50')
result.checks.courseList = Array.isArray(list.body?.courses) && list.body.courses.length > 0
result.samples.courseListCount = list.body?.courses?.length || 0

result.samples.programs = []
for (const sample of fixtures.programSamples) {
  const byCode = await request(`/api/catalog/courses?q=${encodeURIComponent(sample.code)}&program=${sample.program}&year=${sample.academic_year}&semester=${sample.semester}`)
  const byName = await request(`/api/catalog/courses?q=${encodeURIComponent(sample.name_en)}&program=${sample.program}&year=${sample.academic_year}&semester=${sample.semester}`)
  const filtered = await request(`/api/catalog/courses?program=${sample.program}&year=${sample.academic_year}&semester=${sample.semester}&limit=50`)
  result.samples.programs.push({
    program: sample.program, courseCode: sample.code, courseName: sample.name_en,
    academicYear: sample.academic_year, semester: sample.semester,
    codeFound: byCode.body.courses.some(course => course.id === sample.id),
    nameFound: byName.body.courses.some(course => course.id === sample.id),
    filteredFound: filtered.body.courses.some(course => course.id === sample.id)
  })
}
result.checks.courseCodeSearch = result.samples.programs.every(sample => sample.codeFound)
result.checks.courseNameSearch = result.samples.programs.every(sample => sample.nameFound)
result.checks.programFilter = result.samples.programs.every(sample => sample.filteredFound)

const periods = await request('/api/catalog/courses/periods')
const expectedYears = [...new Set(fixtures.periodSamples.map(sample => sample.academic_year))]
const expectedSemesters = [...new Set(fixtures.periodSamples.map(sample => sample.semester))]
result.checks.academicYear = expectedYears.every(year => periods.body.academicYears.includes(year))
result.checks.semester = expectedSemesters.every(semester => periods.body.semesters.includes(semester))
result.samples.periods = { expectedYears, expectedSemesters, returnedYears: periods.body.academicYears, returnedSemesters: periods.body.semesters }

if (!fixtures.multiInstructor) throw new Error('No multi-instructor offering exists for verification')
const teacherPath = `/api/catalog/courses/${encodeURIComponent(fixtures.multiInstructor.course_id)}/teachers?year=${fixtures.multiInstructor.academic_year}&semester=${fixtures.multiInstructor.semester}`
const teachers = await request(teacherPath)
const returnedTeacherIds = new Set(teachers.body.teachers.map(teacher => teacher.id))
result.checks.instructorData = fixtures.multiInstructor.teacher_ids.every(id => returnedTeacherIds.has(id))
result.checks.offeringRelationships = result.checks.instructorData && result.checks.programFilter && result.checks.academicYear && result.checks.semester
result.samples.multiInstructor = {
  courseCode: fixtures.multiInstructor.code, courseName: fixtures.multiInstructor.name_en,
  academicYear: fixtures.multiInstructor.academic_year, semester: fixtures.multiInstructor.semester,
  section: fixtures.multiInstructor.section, expectedTeachers: fixtures.multiInstructor.teachers,
  returnedTeachers: teachers.body.teachers.map(teacher => teacher.name)
}

result.pass = Object.values(result.checks).every(Boolean)
console.log(JSON.stringify(result, null, 2))
if (!result.pass) process.exitCode = 1
