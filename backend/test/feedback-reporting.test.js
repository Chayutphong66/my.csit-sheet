import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-feedback-tests'
process.env.DATABASE_PATH = path.join(tmpdir(), `csit-sheet-feedback-${process.pid}-${Date.now()}.sqlite`)
process.env.SKIP_DB_SEED = '1'
mkdirSync(path.dirname(process.env.DATABASE_PATH), { recursive: true })

const { default: app } = await import('../src/app.js')
const { db } = await import('../src/data/database.js')
const { hashPassword } = await import('../src/services/password.service.js')
const { createRateLimiter } = await import('../src/middleware/security.middleware.js')

const insertUser = db.prepare(`INSERT INTO users
  (id,username,display_name,email,password,role,avatar_url,is_verified,provider,program_code,cohort)
  VALUES (?,?,?,?,?,?, '',1,'local','CS','66')`)
insertUser.run('feedback-admin', 'feedbackadmin', 'Feedback Admin', 'feedback-admin@example.test', hashPassword('Admin@1234'), 'ADMIN')
insertUser.run('feedback-user', 'feedbackuser', 'Feedback User', 'feedback-user@example.test', hashPassword('User@1234'), 'USER')
insertUser.run('other-user', 'feedbackother', 'Other User', 'feedback-other@example.test', hashPassword('User@1234'), 'USER')
db.prepare("INSERT INTO sheets(id,title,subject,status,uploader_id,created_at) VALUES('visible-sheet','Visible','CS101','APPROVED','feedback-user',CURRENT_TIMESTAMP)").run()

const server = app.listen(0)
const baseUrl = `http://127.0.0.1:${server.address().port}/api`
test.after(() => { server.close(); db.close() })

async function api(pathname, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const value = await response.text()
  return { response, data: value ? JSON.parse(value) : null }
}
async function login(username, password) {
  const result = await api('/auth/login', { method: 'POST', body: { usernameOrEmail: username, password } })
  assert.equal(result.response.status, 200)
  return result.data.accessToken
}
const validBody = requestId => ({ clientRequestId: requestId, category: 'BUG', subject: 'Search result problem', description: 'Search results disappear after selecting a semester.', relatedPath: '/dashboard/search', relatedDocumentType: 'Sheet', relatedDocumentId: 'visible-sheet' })

test('feedback migration is additive and SQLite rejects invalid report states', () => {
  const migration = readFileSync(new URL('../migrations/postgres/007_feedback_reporting.sql', import.meta.url), 'utf8')
  assert.match(migration, /CREATE TABLE feedback_reports/)
  assert.match(migration, /CREATE TABLE feedback_report_events/)
  assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE)\b|\bDELETE\s+FROM\b/i)
  assert.throws(() => db.prepare(`INSERT INTO feedback_reports
    (id,public_reference,reporter_user_id,client_request_id,category,subject,description,related_document_type,related_document_id)
    VALUES ('invalid','FB-INVALID','feedback-user','invalid-state-0001','BUG','Invalid','Invalid state','Sheet','')`).run())
})

test('feedback submission is authenticated, validated, idempotent and isolated per reporter', async () => {
  assert.equal((await api('/feedback', { method: 'POST', body: validBody('request-unauthorized-0001') })).response.status, 401)
  const user = await login('feedbackuser', 'User@1234')
  const other = await login('feedbackother', 'User@1234')
  assert.equal((await api('/feedback', { method: 'POST', token: user, body: { ...validBody('request-invalidpath-01'), relatedPath: 'https://example.test/private' } })).response.status, 400)
  assert.equal((await api('/feedback', { method: 'POST', token: user, body: { ...validBody('request-missingdoc-01'), relatedDocumentId: 'missing' } })).response.status, 404)
  const first = await api('/feedback', { method: 'POST', token: user, body: validBody('request-idempotent-001') })
  assert.equal(first.response.status, 201)
  assert.match(first.data.reference, /^FB-[A-F0-9]{16}$/)
  const replay = await api('/feedback', { method: 'POST', token: user, body: validBody('request-idempotent-001') })
  assert.equal(replay.response.status, 200)
  assert.equal(replay.data.reference, first.data.reference)
  assert.equal(replay.data.replayed, true)
  const concurrent = await Promise.all([
    api('/feedback', { method: 'POST', token: user, body: validBody('request-concurrent-001') }),
    api('/feedback', { method: 'POST', token: user, body: validBody('request-concurrent-001') })
  ])
  assert.deepEqual(concurrent.map(result => result.response.status).sort(), [200, 201])
  assert.equal(concurrent[0].data.reference, concurrent[1].data.reference)
  assert.equal((await api(`/feedback/${first.data.reference}`, { token: other })).response.status, 404)
  assert.equal(db.prepare("SELECT COUNT(*) count FROM feedback_reports WHERE reporter_user_id='feedback-user'").get().count, 2)
})

test('admin workflow enforces RBAC, transitions, optimistic concurrency and private notes', async () => {
  const user = await login('feedbackuser', 'User@1234')
  const admin = await login('feedbackadmin', 'Admin@1234')
  assert.equal((await api('/admin/feedback', { token: user })).response.status, 403)
  const list = await api('/admin/feedback?status=OPEN&category=BUG&search=Search&sort=oldest&page=1&limit=10', { token: admin })
  assert.equal(list.response.status, 200)
  assert.equal(list.data.total, 2)
  const firstPage = await api('/admin/feedback?sort=oldest&page=1&limit=1', { token: admin })
  const secondPage = await api('/admin/feedback?sort=oldest&page=2&limit=1', { token: admin })
  assert.equal(firstPage.data.total, 2)
  assert.equal(firstPage.data.items.length, 1)
  assert.equal(secondPage.data.items.length, 1)
  assert.notEqual(firstPage.data.items[0].reference, secondPage.data.items[0].reference)
  const reference = list.data.items[0].reference
  const reviewed = await api(`/admin/feedback/${reference}`, { method: 'PATCH', token: admin, body: { expectedVersion: 0, status: 'IN_REVIEW', internalNote: 'Check query state before responding.', publicMessage: 'กำลังตรวจสอบปัญหา' } })
  assert.equal(reviewed.response.status, 200)
  assert.equal(reviewed.data.version, 1)
  assert.ok(reviewed.data.events.some(event => event.internalNote === 'Check query state before responding.'))
  const stale = await api(`/admin/feedback/${reference}`, { method: 'PATCH', token: admin, body: { expectedVersion: 0, status: 'RESOLVED' } })
  assert.equal(stale.response.status, 409)
  const invalidTransition = await api(`/admin/feedback/${reference}`, { method: 'PATCH', token: admin, body: { expectedVersion: 1, status: 'OPEN' } })
  assert.equal(invalidTransition.response.status, 409)
  const userView = await api(`/feedback/${reference}`, { token: user })
  assert.equal(userView.response.status, 200)
  assert.doesNotMatch(JSON.stringify(userView.data), /Check query state/)
  assert.ok(userView.data.events.some(event => event.publicMessage === 'กำลังตรวจสอบปัญหา'))
})

test('feedback rate limiter returns retry guidance after its configured maximum', () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 60_000, keyPrefix: 'feedback-test' })
  const req = { ip: '127.0.0.9' }
  let nextCalls = 0; let status; let body; const headers = {}
  const res = { set: (name, value) => { headers[name] = value }, status: value => { status = value; return res }, json: value => { body = value } }
  limiter(req, res, () => { nextCalls += 1 }); limiter(req, res, () => { nextCalls += 1 })
  assert.equal(nextCalls, 1); assert.equal(status, 429); assert.ok(headers['Retry-After']); assert.match(body.message, /too many/i)
})
