import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'phase-six-release-qa-secret-long-enough'
process.env.DATABASE_PATH = path.join(tmpdir(), `csit-release-qa-${process.pid}-${Date.now()}.sqlite`)
process.env.SKIP_DB_SEED = '1'
mkdirSync(path.dirname(process.env.DATABASE_PATH), { recursive: true })

const { default: app } = await import('../src/app.js')
const { db } = await import('../src/data/database.js')
const { hashPassword } = await import('../src/services/password.service.js')

db.prepare(`INSERT INTO users(id,username,display_name,email,password,role,avatar_url,is_verified,provider,program_code,cohort)
 VALUES('release-admin','releaseadmin','Release Admin','release-admin@example.test',?,'ADMIN','',1,'local','CS','69')`).run(hashPassword('Admin@1234'))
db.prepare(`INSERT INTO users(id,username,display_name,email,password,role,avatar_url,is_verified,provider,program_code,cohort)
 VALUES('release-user2','releaseuser2','Release User 2','release-user2@example.test',?,'USER','',1,'local','CS','69')`).run(hashPassword('User@1234'))
db.prepare("INSERT INTO courses(id,name,code,description) VALUES('release-course','Release Engineering','RE601','Phase 6 isolated course')").run()
db.prepare("INSERT INTO program_courses(program_id,course_id) VALUES('program-cs','release-course')").run()
db.prepare("INSERT INTO course_offerings(id,course_id,academic_year,semester) VALUES('release-offering','release-course','2569','1')").run()
db.prepare("INSERT INTO course_offering_programs(offering_id,program_id) VALUES('release-offering','program-cs')").run()

const server = app.listen(0)
const base = `http://127.0.0.1:${server.address().port}/api`
test.after(() => { server.close(); db.close() })

async function api(route, { method = 'GET', body, token, cookie } = {}) {
  const response = await fetch(base + route, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: response.status, data, cookie: response.headers.get('set-cookie'), headers: response.headers }
}
async function login(username, password) {
  const result = await api('/auth/login', { method: 'POST', body: { usernameOrEmail: username, password } })
  assert.equal(result.status, 200)
  return result
}
function upload(title, documentType, contents) {
  return { title, fileName: `${title.toLowerCase().replaceAll(' ', '-')}.txt`, fileType: 'text/plain', fileData: Buffer.from(contents).toString('base64'), programId: 'program-cs', courseId: 'release-course', academicYear: '2569', semester: '1', documentType }
}
function bulkItem(clientKey, title, contents, overrides = {}) {
  return { clientKey, title, fileName: `${clientKey}.txt`, fileType: 'text/plain', fileData: Buffer.from(contents).toString('base64'), ...overrides }
}

test('Phase 6 isolated USER1 to ADMIN to USER2 release workflow', async () => {
  const registration = await api('/auth/register', { method: 'POST', body: { username: 'releaseuser1', displayName: 'Release User 1', email: 'release-user1@example.test', password: 'User@1234', confirmPassword: 'User@1234', program: 'CS', cohort: '69' } })
  assert.equal(registration.status, 201)
  const user1Row = db.prepare("SELECT id FROM users WHERE username='releaseuser1'").get()
  assert.ok(user1Row?.id)
  db.prepare('UPDATE users SET is_verified=1,email_verified_at=CURRENT_TIMESTAMP WHERE id=?').run(user1Row.id)

  const user1Session = await login('releaseuser1', 'User@1234')
  const user2Session = await login('releaseuser2', 'User@1234')
  const adminSession = await login('releaseadmin', 'Admin@1234')
  const user1 = user1Session.data.accessToken
  const user2 = user2Session.data.accessToken
  const admin = adminSession.data.accessToken

  const lectureRequest = await api('/upload-requests', { method: 'POST', token: user1, body: upload('Release Lecture', 'Lecture', 'release lecture bytes') })
  const sheetRequest = await api('/upload-requests', { method: 'POST', token: user1, body: upload('Release Sheet', 'Sheet', 'release sheet bytes') })
  assert.equal(lectureRequest.status, 201)
  assert.equal(sheetRequest.status, 201)

  const courseCollection = await api('/collections', { method: 'POST', token: user1, body: { name: 'Release COURSE Collection', collectionType: 'COURSE', courseId: 'release-course' } })
  const mixedCollection = await api('/collections', { method: 'POST', token: user1, body: { name: 'Release MIXED Collection', collectionType: 'MIXED' } })
  assert.equal(courseCollection.status, 201)
  assert.equal(mixedCollection.status, 201)
  assert.equal((await api(`/collections/${courseCollection.data.id}`, { method: 'PATCH', token: user2, body: { name: 'IDOR attempt' } })).status, 404)

  const sharedMetadata = { programId: 'program-cs', courseId: 'release-course', academicYear: '2569', semester: '1', documentType: 'Sheet' }
  let bulk = await api('/collections/bulk-uploads', { method: 'POST', token: user1, body: { collectionId: mixedCollection.data.id, sharedMetadata, items: [
    bulkItem('shared-sheet', 'Shared Sheet', 'shared sheet bytes'),
    bulkItem('override-lecture', 'Override Lecture', 'override lecture bytes', { documentType: 'Lecture' }),
    { ...bulkItem('invalid-file', 'Invalid File', 'invalid bytes'), fileName: '../invalid.txt' }
  ] } })
  assert.equal(bulk.status, 207)
  assert.equal(bulk.data.status, 'PARTIAL')
  const overrideRequestId = bulk.data.items.find(item => item.clientKey === 'override-lecture').requestId
  assert.equal(db.prepare('SELECT document_type documentType FROM upload_requests WHERE id=?').get(overrideRequestId).documentType, 'Lecture')
  assert.equal((await api(`/collections/bulk-uploads/${bulk.data.id}`, { token: user2 })).status, 404)
  bulk = await api(`/collections/bulk-uploads/${bulk.data.id}/retry`, { method: 'POST', token: user1, body: { sharedMetadata, items: [bulkItem('invalid-file', 'Recovered Sheet', 'recovered bytes')] } })
  assert.equal(bulk.status, 200)
  assert.equal(bulk.data.status, 'COMPLETED')

  const lectureApproval = await api(`/admin/upload-requests/${lectureRequest.data.id}/approve`, { method: 'PATCH', token: admin, body: {} })
  const sheetApproval = await api(`/admin/upload-requests/${sheetRequest.data.id}/approve`, { method: 'PATCH', token: admin, body: {} })
  assert.equal(lectureApproval.status, 200)
  assert.equal(sheetApproval.status, 200)
  for (const item of bulk.data.items) {
    const approved = await api(`/admin/upload-requests/${item.requestId}/approve`, { method: 'PATCH', token: admin, body: {} })
    assert.equal(approved.status, 200)
  }
  const lectureId = lectureApproval.data.lectureId
  const sheetId = sheetApproval.data.sheetId
  assert.ok(lectureId && sheetId)

  let courseDetail = await api(`/collections/${courseCollection.data.id}/documents`, { method: 'POST', token: user1, body: { documentType: 'Lecture', documentId: lectureId } })
  assert.equal(courseDetail.status, 201)
  courseDetail = await api(`/collections/${courseCollection.data.id}/documents`, { method: 'POST', token: user1, body: { documentType: 'Sheet', documentId: sheetId } })
  assert.equal(courseDetail.status, 201)
  courseDetail = await api(`/collections/${courseCollection.data.id}/sections`, { method: 'POST', token: user1, body: { title: 'Release section' } })
  const sectionId = courseDetail.data.sections[0].id
  courseDetail = await api(`/collections/${courseCollection.data.id}/order`, { method: 'PUT', token: user1, body: { expectedVersion: courseDetail.data.version, sections: [sectionId], documents: [
    { documentType: 'Lecture', documentId: lectureId, sectionId },
    { documentType: 'Sheet', documentId: sheetId, sectionId }
  ] } })
  assert.equal(courseDetail.status, 200)
  assert.deepEqual(courseDetail.data.sections[0].documents.map(item => item.documentId), [lectureId, sheetId])

  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKsAAAAASUVORK5CYII='
  assert.equal((await api(`/collections/${courseCollection.data.id}/cover`, { method: 'POST', token: user1, body: { fileName: 'release-cover.png', fileData: png } })).status, 200)
  courseDetail = await api(`/collections/${courseCollection.data.id}/cover`, { method: 'DELETE', token: user1 })
  assert.equal(courseDetail.status, 200)

  const concurrentOrder = await Promise.all([
    api(`/collections/${courseCollection.data.id}/order`, { method: 'PUT', token: user1, body: { expectedVersion: courseDetail.data.version, sections: [sectionId], documents: courseDetail.data.documents } }),
    api(`/collections/${courseCollection.data.id}/order`, { method: 'PUT', token: user1, body: { expectedVersion: courseDetail.data.version, sections: [sectionId], documents: courseDetail.data.documents } })
  ])
  assert.deepEqual(concurrentOrder.map(result => result.status).sort(), [200, 409])

  assert.equal((await api(`/collections/${courseCollection.data.id}/lifecycle/publish`, { method: 'POST', token: user1 })).status, 200)
  assert.equal((await api(`/collections/${mixedCollection.data.id}/lifecycle/publish`, { method: 'POST', token: user1 })).status, 200)
  const search = await api('/documents/search?q=Release%20COURSE', { token: user2 })
  const course = await api('/courses/release-course/years', { token: user2 })
  const profile = await api('/contributors/releaseuser1', { token: user2 })
  assert.ok(search.data.collections.some(item => item.id === courseCollection.data.id))
  assert.ok(course.data.collections.some(item => item.id === courseCollection.data.id))
  assert.ok(profile.data.collections.some(item => item.id === courseCollection.data.id))

  const published = await api(`/collections/published/${courseCollection.data.slug}`, { token: user2 })
  assert.equal(published.status, 200)
  assert.deepEqual(published.data.sections[0].documents.map(item => item.documentId), [lectureId, sheetId])
  for (const document of published.data.sections[0].documents) {
    const file = await api(`/collections/published/${courseCollection.data.slug}/documents/${document.documentType.toLowerCase()}/${document.documentId}/view`, { token: user2 })
    assert.equal(file.status, 200)
    assert.equal(file.headers.get('cache-control'), 'private, no-store')
  }
  db.prepare("UPDATE lectures SET status='REJECTED' WHERE id=?").run(lectureId)
  assert.equal((await api(`/collections/published/${courseCollection.data.slug}/documents/lecture/${lectureId}/view`, { token: user2 })).status, 404)
  db.prepare("UPDATE lectures SET status='APPROVED' WHERE id=?").run(lectureId)

  const duplicate = await api('/collections/bulk-uploads', { method: 'POST', token: user1, body: { collectionId: mixedCollection.data.id, sharedMetadata, items: [bulkItem('duplicate-a', 'Duplicate A', 'same release duplicate'), bulkItem('duplicate-b', 'Duplicate B', 'same release duplicate')] } })
  assert.equal(duplicate.status, 207)
  assert.ok(duplicate.data.items.some(item => item.status === 'DUPLICATE'))
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])

  const deactivated = await api(`/admin/users/${user1Row.id}/status`, { method: 'PATCH', token: admin, body: { status: 'DEACTIVATED', reason: 'Phase 6 release session revocation check' } })
  assert.equal(deactivated.status, 200)
  assert.equal((await api('/contributors/me/settings', { token: user1 })).status, 403)
  assert.equal((await api(`/collections/published/${courseCollection.data.slug}/documents/sheet/${sheetId}/view`, { token: user1 })).status, 403)
  assert.equal((await api('/auth/refresh', { method: 'POST', cookie: user1Session.cookie.split(';')[0] })).status, 401)
  assert.equal(db.prepare('SELECT action FROM admin_audit_logs WHERE target_user_id=? ORDER BY created_at DESC LIMIT 1').get(user1Row.id).action, 'USER_DEACTIVATED')
})
