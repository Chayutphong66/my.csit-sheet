import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-phase-four'
process.env.DATABASE_PATH = path.join(tmpdir(), `csit-sheet-phase4-${process.pid}-${Date.now()}.sqlite`)
process.env.SKIP_DB_SEED = '1'
mkdirSync(path.dirname(process.env.DATABASE_PATH), { recursive: true })

const { default: app } = await import('../src/app.js')
const { db } = await import('../src/data/database.js')
const { hashPassword } = await import('../src/services/password.service.js')

const userInsert = db.prepare(`INSERT INTO users
  (id,username,display_name,email,password,role,avatar_url,is_verified,provider,program_code,cohort)
  VALUES (?,?,?,?,?,?, '',1,'local','CS','69')`)
userInsert.run('phase4-admin-a', 'phase4admina', 'Phase 4 Admin A', 'phase4a@example.test', hashPassword('Admin@1234'), 'ADMIN')
userInsert.run('phase4-admin-b', 'phase4adminb', 'Phase 4 Admin B', 'phase4b@example.test', hashPassword('Admin@1234'), 'ADMIN')
userInsert.run('phase4-user', 'phase4user', 'Phase 4 User', 'phase4user@example.test', hashPassword('User@1234'), 'USER')
db.prepare("INSERT INTO courses(id,name,code) VALUES('phase4-course','Phase 4 Course','P401')").run()
db.prepare("INSERT INTO program_courses(program_id,course_id) VALUES('program-cs','phase4-course')").run()
db.prepare("INSERT INTO course_offerings(id,course_id,academic_year,semester) VALUES('phase4-offering','phase4-course','2569','1')").run()
db.prepare("INSERT INTO course_offering_programs(offering_id,program_id) VALUES('phase4-offering','program-cs')").run()

const server = app.listen(0)
const baseUrl = `http://127.0.0.1:${server.address().port}/api`
test.after(() => { server.close(); db.close() })

async function api(route, { method = 'GET', body, token } = {}) {
  const response = await fetch(baseUrl + route, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await response.text()
  return { status: response.status, data: text ? JSON.parse(text) : null }
}

async function login(username, password) {
  const result = await api('/auth/login', { method: 'POST', body: { usernameOrEmail: username, password } })
  assert.equal(result.status, 200)
  return result.data.accessToken
}

function item(clientKey, title, content = 'phase four fixture') {
  return {
    clientKey, title, fileName: `${clientKey}.txt`, fileType: 'text/plain',
    fileData: Buffer.from(content).toString('base64'), documentType: 'Sheet',
    courseId: 'phase4-course', programId: 'program-cs', academicYear: '2569', semester: '1'
  }
}

let adminA; let adminB; let user; let collectionId; let job

test('collection management is admin-only, validated, and archives instead of deleting', async () => {
  adminA = await login('phase4admina', 'Admin@1234')
  adminB = await login('phase4adminb', 'Admin@1234')
  user = await login('phase4user', 'User@1234')
  assert.equal((await api('/admin/collections', { token: user })).status, 403)
  const invalid = await api('/admin/collections', { method: 'POST', token: adminA, body: { name: 'x', status: 'ACTIVE' } })
  assert.equal(invalid.status, 400)
  const created = await api('/admin/collections', { method: 'POST', token: adminA, body: { name: 'Operating Systems 2569', description: 'Curated materials' } })
  assert.equal(created.status, 201)
  collectionId = created.data.id
  assert.equal(created.data.status, 'ACTIVE')
  assert.match(created.data.slug, /^operating-systems-2569/)
  const archived = await api(`/admin/collections/${collectionId}`, { method: 'PATCH', token: adminA, body: { status: 'ARCHIVED' } })
  assert.equal(archived.data.status, 'ARCHIVED')
  const blocked = await api('/admin/bulk-uploads', { method: 'POST', token: adminA, body: { collectionId, items: [item('archived', 'Blocked')] } })
  assert.equal(blocked.status, 409)
  await api(`/admin/collections/${collectionId}`, { method: 'PATCH', token: adminA, body: { status: 'ACTIVE' } })
})

test('bulk upload isolates partial failures, reports duplicates, and protects job IDs', async () => {
  const result = await api('/admin/bulk-uploads', { method: 'POST', token: adminA, body: {
    collectionId,
    items: [item('ok-1', 'First upload', 'identical bytes'), { ...item('bad-1', 'Broken upload'), fileName: '../escape.txt' }, item('duplicate-1', 'Duplicate bytes', 'identical bytes')]
  } })
  assert.equal(result.status, 207)
  job = result.data
  assert.equal(job.status, 'PARTIAL')
  assert.equal(job.items.find(entry => entry.clientKey === 'ok-1').status, 'READY')
  assert.equal(job.items.find(entry => entry.clientKey === 'bad-1').status, 'FAILED')
  assert.equal(job.items.find(entry => entry.clientKey === 'duplicate-1').status, 'DUPLICATE')
  assert.equal(job.succeededItems, 2)
  assert.equal(job.failedItems, 1)
  assert.equal((await api(`/admin/bulk-uploads/${job.id}`, { token: adminB })).status, 404)
  assert.equal((await api(`/admin/bulk-uploads/${job.id}`, { token: user })).status, 403)
})

test('retry changes only failed items and approval links the published document once', async () => {
  const retry = await api(`/admin/bulk-uploads/${job.id}/retry`, { method: 'POST', token: adminA, body: { items: [item('bad-1', 'Recovered upload', 'recovered bytes')] } })
  assert.equal(retry.status, 200)
  assert.equal(retry.data.status, 'COMPLETED')
  assert.equal(retry.data.items.find(entry => entry.clientKey === 'bad-1').attemptCount, 2)
  const invalidRetry = await api(`/admin/bulk-uploads/${job.id}/retry`, { method: 'POST', token: adminA, body: { items: [item('ok-1', 'Not retryable')] } })
  assert.equal(invalidRetry.status, 409)

  const requestId = retry.data.items.find(entry => entry.clientKey === 'ok-1').requestId
  const approved = await api(`/admin/upload-requests/${requestId}/approve`, { method: 'PATCH', token: adminA, body: {} })
  assert.equal(approved.status, 200)
  assert.equal(approved.data.status, 'COMPLETED')
  await api(`/admin/upload-requests/${requestId}/approve`, { method: 'PATCH', token: adminA, body: {} })
  const collection = await api(`/admin/collections/${collectionId}`, { token: adminA })
  assert.equal(collection.status, 200)
  assert.equal(collection.data.documents.length, 1)
  assert.equal(collection.data.documents[0].documentId, approved.data.sheetId)
  assert.equal(db.prepare('SELECT COUNT(*) count FROM collection_documents WHERE collection_id=?').get(collectionId).count, 1)
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
})
