import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-material-tests'
process.env.DATABASE_PATH = path.join(tmpdir(), `csit-sheet-materials-${process.pid}-${Date.now()}.sqlite`)

mkdirSync(path.dirname(process.env.DATABASE_PATH), { recursive: true })

const { default: app } = await import('../src/app.js')
const { db } = await import('../src/data/database.js')
const { hashPassword } = await import('../src/services/password.service.js')

const insertActor = db.prepare(`
  INSERT OR IGNORE INTO users (id, username, email, password, role, avatar_url, is_verified, provider)
  VALUES (?, ?, ?, ?, ?, '', 1, 'local')
`)

insertActor.run('actor-user-1', 'user1', 'user1@example.test', hashPassword('User@1234'), 'USER')
insertActor.run('actor-user-2', 'user2', 'user2@example.test', hashPassword('User@1234'), 'USER')
insertActor.run('actor-admin-1', 'admin1', 'admin1@example.test', hashPassword('Admin@1234'), 'ADMIN')

const server = app.listen(0)
const baseUrl = `http://127.0.0.1:${server.address().port}/api`

test.after(() => {
  server.close()
  db.close()
})

async function api(pathname, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })

  const text = await response.text()
  return {
    response,
    data: text && response.headers.get('content-type')?.includes('application/json')
      ? JSON.parse(text)
      : text
  }
}

async function download(pathname, token) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { authorization: `Bearer ${token}` }
  })
  return {
    response,
    body: Buffer.from(await response.arrayBuffer())
  }
}

async function login(usernameOrEmail, password = 'User@1234') {
  const result = await api('/auth/login', {
    method: 'POST',
    body: { usernameOrEmail, password }
  })
  assert.equal(result.response.status, 200)
  return result.data.accessToken
}

function uploadPayload({ title, fileName, contents, documentType }) {
  return {
    title,
    fileName,
    fileType: 'application/pdf',
    fileData: Buffer.from(contents).toString('base64'),
    courseId: 'c1',
    documentType,
    academicYear: '2026',
    semester: '1',
    instructorId: 'i1'
  }
}

async function approve(requestId, adminToken, documentType) {
  const result = await api(`/admin/upload-requests/${requestId}/approve`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      courseId: 'c1',
      documentType,
      academicYear: '2026',
      semester: '1',
      instructorId: 'i1'
    }
  })
  assert.equal(result.response.status, 200)
  return result.data
}

function findByTitle(items, title) {
  return items.find((item) => item.title === title)
}

function searchByTitle(items, term) {
  const normalized = term.toLowerCase()
  return items.filter((item) => String(item.title).toLowerCase().includes(normalized))
}

async function listLectures(token) {
  const result = await api('/lectures', { token })
  assert.equal(result.response.status, 200)
  return result.data
}

async function listSheets(token) {
  const result = await api('/sheets/all', { token })
  assert.equal(result.response.status, 200)
  return result.data
}

async function uploadAndApprove({ userToken, adminToken, title, documentType, contents }) {
  const upload = await api('/upload-requests', {
    method: 'POST',
    token: userToken,
    body: uploadPayload({
      title,
      fileName: `${title}.pdf`,
      contents,
      documentType
    })
  })
  assert.equal(upload.response.status, 201)
  assert.equal(upload.data.status, 'PENDING')
  assert.equal(upload.data.username, 'user1')

  await approve(upload.data.id, adminToken, documentType)
  return upload.data
}

async function adminPublish({ adminToken, title, documentType, contents }) {
  const result = await api('/admin/upload-requests', {
    method: 'POST',
    token: adminToken,
    body: uploadPayload({
      title,
      fileName: `${title}.pdf`,
      contents,
      documentType
    })
  })
  assert.equal(result.response.status, 201)
  assert.equal(result.data.status, 'COMPLETED')
  assert.equal(result.data.username, 'admin1')
  return result.data
}

test('TEST-01 user1 Lecture upload is hidden while pending, approved by admin1, then found by user2 search', async () => {
  const adminToken = await login('admin1', 'Admin@1234')
  const user1Token = await login('user1')
  const user2Token = await login('user2')

  const title = 'E2E User1 Lecture Unique 001'
  const lectureContents = '%PDF-lecture pdf bytes: E2E User1 Lecture Unique 001'
  const lectureUpload = await api('/upload-requests', {
    method: 'POST',
    token: user1Token,
    body: uploadPayload({
      title,
      fileName: `${title}.pdf`,
      contents: lectureContents,
      documentType: 'Lecture'
    })
  })
  assert.equal(lectureUpload.response.status, 201)
  assert.equal(lectureUpload.data.status, 'PENDING')
  assert.equal(lectureUpload.data.username, 'user1')

  let lectures = await listLectures(user2Token)
  let sheets = await listSheets(user2Token)
  assert.equal(searchByTitle(lectures, title).length, 0)
  assert.equal(searchByTitle(sheets, title).length, 0)

  const privateLectureFile = await download(`/upload-requests/${lectureUpload.data.id}/file`, user2Token)
  assert.equal(privateLectureFile.response.status, 403)
  const unpublishedLectureFile = await download(`/lectures/${lectureUpload.data.id}/file`, user2Token)
  assert.equal(unpublishedLectureFile.response.status, 404)

  const adminRequests = await api('/admin/upload-requests', { token: adminToken })
  assert.equal(adminRequests.response.status, 200)
  assert.ok(findByTitle(adminRequests.data, title))

  const approved = await approve(lectureUpload.data.id, adminToken, 'Lecture')
  assert.equal(approved.status, 'COMPLETED')

  lectures = await listLectures(user2Token)
  sheets = await listSheets(user2Token)
  const lecture = findByTitle(lectures, title)
  assert.ok(lecture)
  assert.equal(lecture.documentType, 'Lecture')
  assert.equal(lecture.uploaderUsername, 'user1')
  assert.equal(lecture.uploaderEmail, undefined)
  assert.equal(lecture.password, undefined)
  assert.equal(lecture.hasFile, true)
  assert.equal(searchByTitle(lectures, 'User1 Lecture Unique').some((item) => item.id === lecture.id), true)
  assert.equal(findByTitle(sheets, title), undefined)

  const completedLectureRequest = (await api(`/upload-requests/${lectureUpload.data.id}`, { token: user1Token })).data
  assert.equal(completedLectureRequest.lectureId, lecture.id)
  assert.equal(completedLectureRequest.sheetId, null)
  assert.equal(completedLectureRequest.hasFile, false)

  const openedLecture = await api(`/lectures/${lecture.id}`, { token: user2Token })
  assert.equal(openedLecture.response.status, 200)
  assert.equal(openedLecture.data.title, title)
  assert.equal(openedLecture.data.documentType, 'Lecture')

  const downloadedLecture = await download(`/lectures/${lecture.id}/file`, user2Token)
  assert.equal(downloadedLecture.response.status, 200)
  assert.equal(downloadedLecture.response.headers.get('content-type'), 'application/pdf')
  assert.match(downloadedLecture.response.headers.get('content-disposition'), /E2E%20User1%20Lecture%20Unique%20001\.pdf/)
  assert.deepEqual(downloadedLecture.body, Buffer.from(lectureContents))

  const lectureAfterDownload = (await api('/lectures', { token: user2Token })).data.find(
    (item) => item.id === lecture.id
  )
  assert.equal(lectureAfterDownload.downloadCount, lecture.downloadCount + 1)
})

test('TEST-02 and TEST-04 user1 Sheet approval is discovered and downloaded by user2 only in Sheets', async () => {
  const adminToken = await login('admin1', 'Admin@1234')
  const user1Token = await login('user1')
  const user2Token = await login('user2')

  const title = 'E2E User1 Sheet Unique 001'
  const sheetContents = '%PDF-sheet pdf bytes: E2E User1 Sheet Unique 001'
  const sheetUpload = await api('/upload-requests', {
    method: 'POST',
    token: user1Token,
    body: uploadPayload({
      title,
      fileName: `${title}.pdf`,
      contents: sheetContents,
      documentType: 'Sheet'
    })
  })
  assert.equal(sheetUpload.response.status, 201)

  let sheets = await listSheets(user2Token)
  assert.equal(findByTitle(sheets, title), undefined)

  await approve(sheetUpload.data.id, adminToken, 'Sheet')

  sheets = await listSheets(user2Token)
  const lectures = await listLectures(user2Token)
  const sheet = findByTitle(sheets, title)
  assert.ok(sheet)
  assert.equal(sheet.documentType, 'Sheet')
  assert.equal(sheet.uploaderUsername, 'user1')
  assert.equal(sheet.uploaderEmail, undefined)
  assert.equal(sheet.hasFile, true)
  assert.equal(searchByTitle(sheets, 'User1 Sheet Unique').some((item) => item.id === sheet.id), true)
  assert.equal(findByTitle(lectures, title), undefined)

  const completedSheetRequest = (await api(`/upload-requests/${sheetUpload.data.id}`, { token: user1Token })).data
  assert.equal(completedSheetRequest.sheetId, sheet.id)
  assert.equal(completedSheetRequest.lectureId, null)

  const downloadedSheet = await download(`/sheets/${sheet.id}/file`, user2Token)
  assert.equal(downloadedSheet.response.status, 200)
  assert.equal(downloadedSheet.response.headers.get('content-type'), 'application/pdf')
  assert.match(downloadedSheet.response.headers.get('content-disposition'), /E2E%20User1%20Sheet%20Unique%20001\.pdf/)
  assert.deepEqual(downloadedSheet.body, Buffer.from(sheetContents))

  const sheetAfterDownload = (await api('/sheets/all', { token: user2Token })).data.find(
    (item) => item.id === sheet.id
  )
  assert.equal(sheetAfterDownload.downloadCount, sheet.downloadCount + 1)
})

test('TEST-03 user2 downloads user1 published Lecture without uploader ownership restriction', async () => {
  const adminToken = await login('admin1', 'Admin@1234')
  const user1Token = await login('user1')
  const user2Token = await login('user2')

  const title = 'E2E User1 Lecture Download Unique 001'
  await uploadAndApprove({
    userToken: user1Token,
    adminToken,
    title,
    documentType: 'Lecture',
    contents: '%PDF-cross-user lecture download bytes'
  })

  const lecture = findByTitle(await listLectures(user2Token), title)
  assert.ok(lecture)
  const downloaded = await download(`/lectures/${lecture.id}/download`, user2Token)
  assert.equal(downloaded.response.status, 200)
  assert.deepEqual(downloaded.body, Buffer.from('%PDF-cross-user lecture download bytes'))
})

test('TEST-05 admin1 direct Lecture upload is immediately public to user1 and user2', async () => {
  const adminToken = await login('admin1', 'Admin@1234')
  const user1Token = await login('user1')
  const user2Token = await login('user2')

  const title = 'E2E Admin Lecture Unique 001'
  const request = await adminPublish({
    adminToken,
    title,
    documentType: 'Lecture',
    contents: '%PDF-admin lecture bytes'
  })
  assert.ok(request.lectureId)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM lecture_files WHERE lecture_id = ?').get(request.lectureId).count, 1)

  for (const token of [user1Token, user2Token]) {
    const lectures = await listLectures(token)
    const sheets = await listSheets(token)
    const lecture = findByTitle(lectures, title)
    assert.ok(lecture)
    assert.equal(lecture.uploaderUsername, 'admin1')
    assert.equal(findByTitle(sheets, title), undefined)
    const downloaded = await download(`/lectures/${lecture.id}/download`, token)
    assert.equal(downloaded.response.status, 200)
  }
})

test('TEST-06 admin1 direct Sheet upload is immediately public to user1 and user2', async () => {
  const adminToken = await login('admin1', 'Admin@1234')
  const user1Token = await login('user1')
  const user2Token = await login('user2')

  const title = 'E2E Admin Sheet Unique 001'
  const request = await adminPublish({
    adminToken,
    title,
    documentType: 'Sheet',
    contents: '%PDF-admin sheet bytes'
  })
  assert.ok(request.sheetId)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sheet_files WHERE sheet_id = ?').get(request.sheetId).count, 1)

  for (const token of [user1Token, user2Token]) {
    const sheets = await listSheets(token)
    const lectures = await listLectures(token)
    const sheet = findByTitle(sheets, title)
    assert.ok(sheet)
    assert.equal(sheet.uploaderUsername, 'admin1')
    assert.equal(findByTitle(lectures, title), undefined)
    const downloaded = await download(`/sheets/${sheet.id}/download`, token)
    assert.equal(downloaded.response.status, 200)
  }
})

test('TEST-07 rejected user1 upload stays private and visible to user1 with reason', async () => {
  const adminToken = await login('admin1', 'Admin@1234')
  const user1Token = await login('user1')
  const user2Token = await login('user2')

  const title = 'E2E Rejected File Unique 001'
  const rejectedUpload = await api('/upload-requests', {
    method: 'POST',
    token: user1Token,
    body: uploadPayload({
      title,
      fileName: `${title}.pdf`,
      contents: '%PDF-rejected bytes',
      documentType: 'Sheet'
    })
  })
  assert.equal(rejectedUpload.response.status, 201)

  const rejection = await api(`/admin/upload-requests/${rejectedUpload.data.id}/reject`, {
    method: 'PATCH',
    token: adminToken,
    body: { reason: 'Duplicate material' }
  })
  assert.equal(rejection.response.status, 200)

  const sheets = await listSheets(user2Token)
  const lectures = await listLectures(user2Token)
  assert.equal(searchByTitle(sheets, title).length, 0)
  assert.equal(searchByTitle(lectures, title).length, 0)

  const rejectedPrivateFile = await download(`/upload-requests/${rejectedUpload.data.id}/file`, user2Token)
  assert.equal(rejectedPrivateFile.response.status, 403)
  const rejectedPublicFile = await download(`/sheets/${rejectedUpload.data.id}/file`, user2Token)
  assert.equal(rejectedPublicFile.response.status, 404)

  const user1Requests = await api('/upload-requests', { token: user1Token })
  const rejected = findByTitle(user1Requests.data, title)
  assert.ok(rejected)
  assert.equal(rejected.status, 'REJECTED')
  assert.equal(rejected.rejectionReason, 'Duplicate material')
})

test('TEST-08 user1 cannot see user2 private upload requests', async () => {
  const adminToken = await login('admin1', 'Admin@1234')
  const user1Token = await login('user1')
  const user2Token = await login('user2')

  const title = 'E2E User2 Private Request Unique 001'
  const user2Upload = await api('/upload-requests', {
    method: 'POST',
    token: user2Token,
    body: uploadPayload({
      title,
      fileName: `${title}.pdf`,
      contents: '%PDF-user2 private bytes',
      documentType: 'Lecture'
    })
  })
  assert.equal(user2Upload.response.status, 201)

  const user1RequestRead = await api(`/upload-requests/${user2Upload.data.id}`, { token: user1Token })
  assert.equal(user1RequestRead.response.status, 403)
  const user1FileRead = await download(`/upload-requests/${user2Upload.data.id}/file`, user1Token)
  assert.equal(user1FileRead.response.status, 403)
  const user1Requests = await api('/upload-requests', { token: user1Token })
  assert.equal(findByTitle(user1Requests.data, title), undefined)

  const adminRequests = await api('/admin/upload-requests', { token: adminToken })
  assert.ok(findByTitle(adminRequests.data, title))
})

test('TEST-09 user2 cannot access Admin approval API', async () => {
  const user1Token = await login('user1')
  const user2Token = await login('user2')

  const upload = await api('/upload-requests', {
    method: 'POST',
    token: user1Token,
    body: uploadPayload({
      title: 'E2E Forbidden Approval Unique 001',
      fileName: 'E2E Forbidden Approval Unique 001.pdf',
      contents: '%PDF-forbidden approval bytes',
      documentType: 'Lecture'
    })
  })
  assert.equal(upload.response.status, 201)

  const approval = await api(`/admin/upload-requests/${upload.data.id}/approve`, {
    method: 'PATCH',
    token: user2Token,
    body: {
      courseId: 'c1',
      documentType: 'Lecture',
      academicYear: '2026',
      semester: '1',
      instructorId: 'i1'
    }
  })
  assert.equal(approval.response.status, 403)
})

test('TEST-10 Lecture never leaks into Sheet search and Sheet never leaks into Lecture search', async () => {
  const adminToken = await login('admin1', 'Admin@1234')
  const user1Token = await login('user1')
  const user2Token = await login('user2')

  const lectureTitle = 'E2E Catalog Separation Lecture Unique 001'
  const sheetTitle = 'E2E Catalog Separation Sheet Unique 001'
  await uploadAndApprove({
    userToken: user1Token,
    adminToken,
    title: lectureTitle,
    documentType: 'Lecture',
    contents: '%PDF-catalog lecture bytes'
  })
  await uploadAndApprove({
    userToken: user1Token,
    adminToken,
    title: sheetTitle,
    documentType: 'Sheet',
    contents: '%PDF-catalog sheet bytes'
  })

  const lectures = await listLectures(user2Token)
  const sheets = await listSheets(user2Token)
  assert.ok(findByTitle(lectures, lectureTitle))
  assert.equal(findByTitle(sheets, lectureTitle), undefined)
  assert.ok(findByTitle(sheets, sheetTitle))
  assert.equal(findByTitle(lectures, sheetTitle), undefined)

  const lectureCatalog = await api('/sheets/catalog?type=lectures', { token: user2Token })
  const sheetCatalog = await api('/sheets/catalog?type=sheets', { token: user2Token })
  assert.equal(JSON.stringify(lectureCatalog.data).includes(lectureTitle), true)
  assert.equal(JSON.stringify(lectureCatalog.data).includes(sheetTitle), false)
  assert.equal(JSON.stringify(sheetCatalog.data).includes(sheetTitle), true)
  assert.equal(JSON.stringify(sheetCatalog.data).includes(lectureTitle), false)
})

test('seeded catalog records still render without files', async () => {
  const user2Token = await login('user2')
  const sheets = await api('/sheets/all', { token: user2Token })
  const lectures = await api('/lectures', { token: user2Token })

  const seededLecture = lectures.data.find((lecture) => lecture.id === 'l1')
  const seededSheet = sheets.data.find((sheet) => sheet.id === 's1')
  assert.ok(seededLecture)
  assert.ok(seededSheet)
  assert.equal(seededLecture.hasFile, false)
  assert.equal(seededSheet.hasFile, false)
  const missingSeededFile = await download('/sheets/s1/download', user2Token)
  assert.equal(missingSeededFile.response.status, 404)
})

test('three actors share dynamic Course hierarchy, search, inline view, download, and idempotent approval', async () => {
  const adminToken = await login('admin1', 'Admin@1234')
  const user1Token = await login('user1')
  const user2Token = await login('user2')
  const title = 'Dynamic Hierarchy Lecture 2568'
  const upload = await api('/upload-requests', {
    method: 'POST', token: user1Token,
    body: { ...uploadPayload({ title, fileName: 'hierarchy-lecture.pdf', contents: '%PDF-hierarchy-2568', documentType: 'Lecture' }), academicYear: '2568', semester: '2' }
  })
  assert.equal(upload.response.status, 201)
  assert.equal(upload.data.semester, '2')
  const firstApproval = await api(`/admin/upload-requests/${upload.data.id}/approve`, { method: 'PATCH', token: adminToken, body: {} })
  assert.equal(firstApproval.response.status, 200)
  const secondApproval = await api(`/admin/upload-requests/${upload.data.id}/approve`, { method: 'PATCH', token: adminToken, body: {} })
  assert.equal(secondApproval.response.status, 200)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM lectures WHERE source_request_id = ?').get(upload.data.id).count, 1)

  const courses = await api('/courses', { token: user2Token })
  const algorithm = courses.data.find((course) => course.id === 'c1')
  assert.ok(algorithm.documentCount >= 1)
  const years = await api('/courses/c1/years', { token: user2Token })
  assert.ok(years.data.years.some((year) => year.academicYear === '2568'))
  const hierarchy = await api('/courses/c1/years/2568', { token: user2Token })
  assert.equal(hierarchy.data.semesters.find((item) => item.semester === '2').documents[0].title, title)
  const search = await api('/documents/search?q=hierarchy-lect', { token: user2Token })
  const document = search.data.documents.find((item) => item.title === title)
  assert.ok(document)
  const lectureCourses = await api('/courses?type=Lecture', { token: user2Token })
  assert.ok(lectureCourses.data.find((course) => course.id === 'c1').documentCount >= 1)
  const lectureHierarchy = await api('/courses/c1/years/2568?type=Lecture', { token: user2Token })
  assert.ok(lectureHierarchy.data.semesters.some((item) => item.documents.some((entry) => entry.title === title)))
  const sheetHierarchy = await api('/courses/c1/years/2568?type=Sheet', { token: user2Token })
  assert.equal(sheetHierarchy.data.semesters.some((item) => item.documents.some((entry) => entry.title === title)), false)
  const lectureSearch = await api('/documents/search?q=hierarchy-lect&type=Lecture', { token: user2Token })
  const sheetSearch = await api('/documents/search?q=hierarchy-lect&type=Sheet', { token: user2Token })
  assert.ok(lectureSearch.data.documents.some((entry) => entry.title === title))
  assert.equal(sheetSearch.data.documents.some((entry) => entry.title === title), false)
  const view = await download(`/documents/lecture/${document.id}/view`, user2Token)
  assert.equal(view.response.status, 200)
  assert.match(view.response.headers.get('content-disposition'), /^inline/)
  const file = await download(`/documents/lecture/${document.id}/download`, user2Token)
  assert.equal(file.response.status, 200)
  assert.match(file.response.headers.get('content-disposition'), /^attachment/)
})

test('exact and possible duplicates include pending matches while distinct same-semester files remain valid', async () => {
  const adminToken = await login('admin1', 'Admin@1234')
  const user1Token = await login('user1')
  const user2Token = await login('user2')
  const base = uploadPayload({ title: 'Duplicate Candidate Alpha', fileName: 'duplicate-a.pdf', contents: '%PDF-exact-pending-unique', documentType: 'Sheet' })
  const first = await api('/upload-requests', { method: 'POST', token: user1Token, body: base })
  assert.equal(first.data.duplicateStatus, 'NONE')
  const exact = await api('/upload-requests', { method: 'POST', token: user2Token, body: { ...base, title: 'Different title', fileName: 'duplicate-b.pdf' } })
  assert.equal(exact.data.duplicateStatus, 'EXACT_DUPLICATE')
  const directAdminDuplicate = await api('/admin/upload-requests', { method: 'POST', token: adminToken, body: { ...base, title: 'Admin exact copy' } })
  assert.equal(directAdminDuplicate.response.status, 409)
  const possible = await api('/upload-requests', { method: 'POST', token: user2Token, body: { ...base, title: '  duplicate   candidate ALPHA ', fileName: 'duplicate-c.pdf', fileData: Buffer.from('%PDF-different-possible').toString('base64') } })
  assert.equal(possible.data.duplicateStatus, 'POSSIBLE_DUPLICATE')
  const distinct = await api('/upload-requests', { method: 'POST', token: user2Token, body: { ...base, title: 'Another valid lecture', fileName: 'distinct.pdf', fileData: Buffer.from('%PDF-distinct').toString('base64') } })
  assert.equal(distinct.data.duplicateStatus, 'NONE')

  const review = await api('/admin/upload-requests', { token: adminToken })
  assert.ok(review.data.find((item) => item.id === exact.data.id).duplicateMatches.some((match) => match.id === first.data.id))
  const before = (await api('/courses', { token: user1Token })).data.find((course) => course.id === 'c1').documentCount
  const rejected = await api(`/admin/upload-requests/${exact.data.id}/reject-duplicate`, { method: 'PATCH', token: adminToken, body: {} })
  assert.equal(rejected.response.status, 200)
  assert.equal(rejected.data.rejectionType, 'DUPLICATE')
  const after = (await api('/courses', { token: user1Token })).data.find((course) => course.id === 'c1').documentCount
  assert.equal(after, before)
})

test('Profile contributions count each owned submission once before and after publication', async () => {
  const adminToken = await login('admin1', 'Admin@1234')
  const user1Token = await login('user1')
  const before = (await api('/upload-requests/contributions', { token: user1Token })).data
  const lecture = await api('/upload-requests', { method: 'POST', token: user1Token,
    body: uploadPayload({ title: 'Contribution Lecture Unique', fileName: 'contribution-lecture.pdf', contents: '%PDF-contribution-lecture', documentType: 'Lecture' }) })
  const pending = (await api('/upload-requests/contributions', { token: user1Token })).data
  assert.equal(pending.total, before.total + 1)
  assert.equal(pending.lectures, before.lectures + 1)
  assert.equal(pending.pending, before.pending + 1)
  await approve(lecture.data.id, adminToken, 'Lecture')
  const published = (await api('/upload-requests/contributions', { token: user1Token })).data
  assert.equal(published.total, pending.total)
  assert.equal(published.lectures, pending.lectures)
  assert.equal(published.published, before.published + 1)
  const sheet = await api('/upload-requests', { method: 'POST', token: user1Token,
    body: uploadPayload({ title: 'Contribution Sheet Unique', fileName: 'contribution-sheet.pdf', contents: '%PDF-contribution-sheet', documentType: 'Sheet' }) })
  assert.equal(sheet.response.status, 201)
  const final = (await api('/upload-requests/contributions', { token: user1Token })).data
  assert.equal(final.total, before.total + 2)
  assert.equal(final.lectures, before.lectures + 1)
  assert.equal(final.sheets, before.sheets + 1)
})

test('publication failure rolls back the material, published file, and request completion', async () => {
  const adminToken = await login('admin', 'Admin@1234')
  const userToken = await login('student01')
  const upload = await api('/upload-requests', {
    method: 'POST',
    token: userToken,
    body: uploadPayload({
      title: 'Atomic Lecture Upload',
      fileName: 'atomic.pdf',
      contents: '%PDF-atomic lecture bytes',
      documentType: 'Lecture'
    })
  })
  assert.equal(upload.response.status, 201)

  db.exec(`
    CREATE TRIGGER fail_lecture_file_publication
    BEFORE INSERT ON lecture_files
    BEGIN
      SELECT RAISE(ABORT, 'forced publication failure');
    END;
  `)

  const approval = await api(`/admin/upload-requests/${upload.data.id}/approve`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      courseId: 'c1',
      documentType: 'Lecture',
      academicYear: '2026',
      semester: '1',
      instructorId: 'i1'
    }
  })
  assert.equal(approval.response.status, 500)
  db.exec('DROP TRIGGER fail_lecture_file_publication')

  const request = (await api(`/upload-requests/${upload.data.id}`, { token: userToken })).data
  assert.equal(request.status, 'PENDING')
  assert.equal(request.hasFile, true)

  const lectures = (await api('/lectures', { token: userToken })).data
  assert.equal(lectures.some((lecture) => lecture.title === 'Atomic Lecture Upload'), false)
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM lecture_files WHERE original_filename = ?').get('atomic.pdf').count,
    0
  )
})

test('invalid file metadata and spoofed file contents are rejected safely', async () => {
  const userToken = await login('student01')

  const wrongExtension = await api('/upload-requests', {
    method: 'POST',
    token: userToken,
    body: uploadPayload({
      title: 'Wrong extension',
      fileName: 'notes.exe',
      contents: '%PDF-content',
      documentType: 'Sheet'
    })
  })
  assert.equal(wrongExtension.response.status, 400)

  const spoofedPdf = await api('/upload-requests', {
    method: 'POST',
    token: userToken,
    body: uploadPayload({
      title: 'Spoofed PDF',
      fileName: 'spoofed.pdf',
      contents: 'not a pdf',
      documentType: 'Lecture'
    })
  })
  assert.equal(spoofedPdf.response.status, 400)

  const invalidCourse = await api('/upload-requests', {
    method: 'POST',
    token: userToken,
    body: { ...uploadPayload({
      title: 'Unknown course',
      fileName: 'course.pdf',
      contents: '%PDF-content',
      documentType: 'Sheet'
    }), courseId: 'missing' }
  })
  assert.equal(invalidCourse.response.status, 400)
})

test('health check is minimal and does not require authentication', async () => {
  const result = await api('/health')
  assert.equal(result.response.status, 200)
  assert.deepEqual(result.data, { status: 'ok' })
})
