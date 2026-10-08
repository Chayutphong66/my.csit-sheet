import crypto from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'

const statePath = path.join(os.tmpdir(), 'csit-sheet-phase4-acceptance.json')
const productionUrl = 'https://mycsit-sheet-production.up.railway.app'
let state
try { state = JSON.parse(await readFile(statePath, 'utf8')) } catch { state = null }
let account = state?.accounts?.user
if (!account?.password) {
  const suffix = `${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`
  account = {
    username: `phase4_storage_user_${suffix}`,
    email: `phase4_storage_user_${suffix}@example.invalid`,
    displayName: 'Phase 4 Storage Diagnostic', password: `P4!${crypto.randomBytes(18).toString('base64url')}`,
    program: 'IT', cohort: '69'
  }
  const registration = await fetch(`${productionUrl}/api/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(account)
  })
  if (registration.status !== 201) throw new Error(`Disposable USER registration failed with HTTP ${registration.status}`)
  state = { productionUrl, createdAt: new Date().toISOString(), accounts: { user: account } }
  await writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 })
}

const login = await fetch(`${productionUrl}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ usernameOrEmail: account.username, password: account.password })
})
const loginBody = await login.json()
if (login.status !== 200 || !loginBody.accessToken) throw new Error(`Disposable USER login failed with HTTP ${login.status}`)

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 })
let fixture
try {
  const result = await pool.query(`
    SELECT o.id AS offering_id,c.id AS course_id,o.academic_year,o.semester,
      op.program_id,array_agg(i.id ORDER BY i.name) AS teacher_ids
    FROM course_offerings o JOIN courses c ON c.id=o.course_id
    JOIN course_offering_teachers ot ON ot.offering_id=o.id JOIN instructors i ON i.id=ot.teacher_id
    JOIN course_offering_programs op ON op.offering_id=o.id
    GROUP BY o.id,c.id,o.academic_year,o.semester,op.program_id
    HAVING COUNT(*)>1 ORDER BY COUNT(*) DESC,c.id LIMIT 1
  `)
  fixture = result.rows[0]
} finally {
  await pool.end()
}
if (!fixture) throw new Error('Verified multi-instructor offering is unavailable')

const marker = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`
const bytes = Buffer.from(`CSIT Sheet Railway Storage diagnostic ${marker}\n`, 'utf8')
const response = await fetch(`${productionUrl}/api/upload-requests`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${loginBody.accessToken}` },
  body: JSON.stringify({
    title: `Storage diagnostic ${marker}`,
    description: 'Disposable Railway Storage diagnostic fixture',
    fileName: `storage-diagnostic-${marker}.txt`, fileType: 'text/plain', fileSize: bytes.length,
    fileData: bytes.toString('base64'), courseId: fixture.course_id, programId: fixture.program_id,
    documentType: 'Sheet', academicYear: fixture.academic_year, semester: fixture.semester,
    instructorIds: fixture.teacher_ids, suggestionIds: []
  })
})
const text = await response.text()
let body
try { body = text ? JSON.parse(text) : null } catch { body = null }
console.log(JSON.stringify({
  status: response.status,
  requestId: response.headers.get('x-request-id'),
  uploadRequestId: body?.id || null,
  message: body?.message || null
}, null, 2))
