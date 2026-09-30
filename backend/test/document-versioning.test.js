import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.NODE_ENV = 'test'
process.env.SKIP_DB_SEED = '1'
process.env.JWT_SECRET = 'version-test-secret-that-is-long-enough'
process.env.DATABASE_PATH = path.join(tmpdir(), `csit-sheet-versions-${process.pid}-${Date.now()}.sqlite`)
const { default: app } = await import('../src/app.js')
const { db } = await import('../src/data/database.js')
const { hashPassword } = await import('../src/services/password.service.js')

const addUser = db.prepare("INSERT INTO users(id,username,display_name,email,password,role) VALUES(?,?,?,?,?,?)")
addUser.run('version-u1', 'versionuser1', 'Version User 1', 'vu1@test.local', hashPassword('User@1234'), 'USER')
addUser.run('version-u2', 'versionuser2', 'Version User 2', 'vu2@test.local', hashPassword('User@1234'), 'USER')
addUser.run('version-admin', 'versionadmin', 'Version Admin', 'va@test.local', hashPassword('Admin@1234'), 'ADMIN')
db.prepare("INSERT INTO courses(id,name,code,description) VALUES('version-course','Version Course','VER101','Version fixture')").run()
db.prepare("INSERT INTO programs(id,code,name_th,name_en) VALUES('version-program','CS','CS','Computer Science') ON CONFLICT(code) DO NOTHING").run()
db.prepare("INSERT OR IGNORE INTO program_courses(program_id,course_id) VALUES('program-cs','version-course')").run()
db.prepare("INSERT INTO course_offerings(id,course_id,academic_year,semester,section) VALUES('version-offer','version-course','2569','1','')").run()

const server = app.listen(0)
const base = `http://127.0.0.1:${server.address().port}/api`
test.after(() => { server.close(); db.close() })

async function api(url, { method = 'GET', token, body } = {}) {
  const response = await fetch(base + url, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await response.text()
  return { status: response.status, data: response.headers.get('content-type')?.includes('json') && text ? JSON.parse(text) : text }
}
async function login(usernameOrEmail, password = 'User@1234') { return (await api('/auth/login', { method: 'POST', body: { usernameOrEmail, password } })).data.accessToken }
const pdf = text => Buffer.from(`%PDF-1.4\n${text}\n%%EOF`)
const revisionBody = (name, text, summary) => ({ revisionType: 'UPDATE_DOCUMENT', changeSummary: summary, fileName: name, fileType: 'application/pdf', fileData: pdf(text).toString('base64') })

test('canonical documents keep immutable approved history through approval, rejection, duplicate detection, another contributor, and restore', async () => {
  const user1 = await login('versionuser1'); const user2 = await login('versionuser2'); const admin = await login('versionadmin', 'Admin@1234')
  const initialPayload = { title: 'Canonical Lecture', description: 'One document, many versions', fileName: 'lecture-v1.pdf', fileType: 'application/pdf', fileData: pdf('version one').toString('base64'), courseId: 'version-course', programId: 'program-cs', documentType: 'Lecture', academicYear: '2569', semester: '1' }
  const initial = await api('/upload-requests', { method: 'POST', token: user1, body: initialPayload })
  assert.equal(initial.status, 201)
  const published = await api(`/admin/upload-requests/${initial.data.id}/approve`, { method: 'PATCH', token: admin, body: {} })
  assert.equal(published.status, 200)
  const documentId = published.data.lectureId

  const requestCount = db.prepare('SELECT COUNT(1) count FROM upload_requests').get().count
  const duplicatePreview = await api('/upload-requests/duplicate-check', { method: 'POST', token: user2, body: { ...initialPayload, fileName: 'same-file-renamed.pdf' } })
  assert.equal(duplicatePreview.status, 200)
  assert.equal(duplicatePreview.data.exactDuplicate, true)
  assert.equal(duplicatePreview.data.matches[0].publicDocumentId, documentId)
  assert.equal(db.prepare('SELECT COUNT(1) count FROM upload_requests').get().count, requestCount)

  let detail = await api(`/documents/lecture/${documentId}`, { token: user1 })
  assert.equal(detail.data.currentVersion.versionNumber, 1)
  const beforeScore = (await api('/upload-requests/contributions', { token: user1 })).data.contributionScore

  const pending = await api(`/documents/lecture/${documentId}/revisions`, { method: 'POST', token: user1, body: revisionBody('lecture-v2.pdf', 'version two', 'Updated examples and corrected lecture content') })
  assert.equal(pending.status, 201); assert.equal(pending.data.status, 'PENDING'); assert.equal(pending.data.versionNumber, null)
  detail = await api(`/documents/lecture/${documentId}`, { token: user2 }); assert.equal(detail.data.currentVersion.versionNumber, 1)
  assert.equal((await api(`/admin/revisions/${pending.data.id}/approve`, { method: 'PATCH', token: user1 })).status, 403)
  assert.equal((await api(`/admin/revisions/${pending.data.id}/approve`, { method: 'PATCH', token: admin })).data.versionNumber, 2)
  assert.equal((await api(`/admin/revisions/${pending.data.id}/approve`, { method: 'PATCH', token: admin })).status, 409)
  assert.equal(db.prepare("SELECT MAX(version_number) value FROM document_versions WHERE document_type='Lecture' AND document_id=?").get(documentId).value, 2)
  assert.equal((await api('/upload-requests/contributions', { token: user1 })).data.contributionScore, beforeScore + 20)

  const rejected = await api(`/documents/lecture/${documentId}/revisions`, { method: 'POST', token: user1, body: revisionBody('lecture-rejected.pdf', 'rejected version', 'Proposal that should be rejected safely') })
  assert.equal((await api(`/admin/revisions/${rejected.data.id}/reject`, { method: 'PATCH', token: admin, body: { reason: 'Content does not match the course' } })).status, 200)
  detail = await api(`/documents/lecture/${documentId}`, { token: user1 }); assert.equal(detail.data.currentVersion.versionNumber, 2)
  const own = await api('/documents/my/revisions', { token: user1 }); assert.equal(own.data.revisions.find(item => item.id === rejected.data.id).reviewNote, 'Content does not match the course')

  const exact = await api(`/documents/lecture/${documentId}/revisions`, { method: 'POST', token: user2, body: revisionBody('renamed-identical.pdf', 'version two', 'Same binary under a different filename') })
  assert.equal(exact.status, 409)
  const third = await api(`/documents/lecture/${documentId}/revisions`, { method: 'POST', token: user2, body: revisionBody('lecture-v3.pdf', 'version three', 'Added a new worked example from another contributor') })
  assert.equal((await api(`/admin/revisions/${third.data.id}/approve`, { method: 'PATCH', token: admin })).data.versionNumber, 3)

  const historyBeforeRestore = await api(`/documents/lecture/${documentId}/versions`, { token: user1 })
  assert.deepEqual(historyBeforeRestore.data.versions.map(item => item.versionNumber), [3, 2, 1])
  const v1 = historyBeforeRestore.data.versions.find(item => item.versionNumber === 1)
  const restored = await api(`/admin/documents/lecture/${documentId}/restore/${v1.id}`, { method: 'POST', token: admin })
  assert.equal(restored.status, 201); assert.equal(restored.data.versionNumber, 4); assert.equal(restored.data.sourceVersionNumber, 1)
  const history = await api(`/documents/lecture/${documentId}/versions`, { token: user1 })
  assert.deepEqual(history.data.versions.map(item => item.versionNumber), [4, 3, 2, 1])
  const oldFile = await api(`/documents/lecture/${documentId}/versions/${v1.id}/download`, { token: user1 })
  assert.equal(oldFile.status, 200); assert.match(oldFile.data, /version one/)
  const search = await api('/documents/search?q=Canonical', { token: user1 })
  assert.equal(search.data.documents.filter(item => item.id === documentId).length, 1)
  const approvedQueue = await api('/admin/revisions?status=approved', { token: admin })
  const rejectedQueue = await api('/admin/revisions?status=REJECTED', { token: admin })
  const allQueue = await api('/admin/revisions', { token: admin })
  assert.equal(approvedQueue.data.revisions.every(item => item.status === 'APPROVED'), true)
  assert.equal(rejectedQueue.data.revisions.length, 1)
  assert.equal(rejectedQueue.data.revisions[0].reviewNote, 'Content does not match the course')
  assert.equal(allQueue.data.revisions.length, approvedQueue.data.revisions.length + rejectedQueue.data.revisions.length)
  assert.equal((await api('/admin/revisions?status=HELLO', { token: admin })).status, 400)
  assert.equal((await api('/admin/upload-requests?status=approved', { token: admin })).data.every(item => item.status === 'COMPLETED'), true)
  assert.equal((await api('/admin/upload-requests?status=HELLO', { token: admin })).status, 400)
  assert.equal(db.prepare('SELECT COUNT(1) count FROM file_assets').get().count, 4)
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
})
