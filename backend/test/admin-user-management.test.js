import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-admin-user-tests'
process.env.DATABASE_PATH = path.join(tmpdir(), `csit-sheet-admin-users-${process.pid}-${Date.now()}.sqlite`)
process.env.SKIP_DB_SEED = '1'
mkdirSync(path.dirname(process.env.DATABASE_PATH), { recursive: true })

const { default: app } = await import('../src/app.js')
const { db } = await import('../src/data/database.js')
const { hashPassword } = await import('../src/services/password.service.js')
const { changeUserStatus } = await import('../src/services/adminUser.service.js')

const insert = db.prepare(`INSERT INTO users
  (id,username,display_name,email,password,role,avatar_url,is_verified,provider,program_code,cohort)
  VALUES (?,?,?,?,?,?, '',1,'local',?,?)`)
insert.run('admin-a', 'adminalpha', 'Admin Alpha', 'admin.alpha@example.test', hashPassword('Admin@1234'), 'ADMIN', 'CS', '66')
insert.run('admin-b', 'adminbeta', 'Admin Beta', 'admin.beta@example.test', hashPassword('Admin@1234'), 'ADMIN', 'IT', '67')
insert.run('managed-user', 'manageduser', 'Managed User', 'managed@example.test', hashPassword('User@1234'), 'USER', 'CS', '66')
insert.run('ordinary-user', 'ordinaryuser', 'Ordinary User', 'ordinary@example.test', hashPassword('User@1234'), 'USER', 'IT', '67')

db.prepare("INSERT INTO lectures(id,title,subject,uploader_id,created_at) VALUES('kept-lecture','Kept lecture','Test','managed-user',CURRENT_TIMESTAMP)").run()
db.prepare("INSERT INTO sheets(id,title,subject,status,created_at,uploader_id) VALUES('kept-sheet','Kept sheet','Test','APPROVED',CURRENT_TIMESTAMP,'managed-user')").run()
db.prepare("INSERT INTO upload_requests(id,user_id,title,file_name,document_type,status) VALUES('kept-upload','managed-user','Kept upload','kept.pdf','Sheet','PENDING')").run()

const server = app.listen(0)
const baseUrl = `http://127.0.0.1:${server.address().port}/api`
test.after(() => { server.close(); db.close() })

async function api(pathname, { method = 'GET', body, token, cookie } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await response.text()
  return { response, data: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie') }
}

async function login(username, password) {
  const result = await api('/auth/login', { method: 'POST', body: { usernameOrEmail: username, password } })
  assert.equal(result.response.status, 200)
  return result
}

test('admin user list is searchable, paginated, safe, and protected by RBAC', async () => {
  const admin = await login('adminalpha', 'Admin@1234')
  const ordinary = await login('ordinaryuser', 'User@1234')
  const denied = await api('/admin/users', { token: ordinary.data.accessToken })
  assert.equal(denied.response.status, 403)

  const result = await api('/admin/users?search=managed%40example.test&page=1&limit=1', { token: admin.data.accessToken })
  assert.equal(result.response.status, 200)
  assert.equal(result.data.items.length, 1)
  assert.equal(result.data.items[0].id, 'managed-user')
  assert.equal(result.data.items[0].password, undefined)
  assert.deepEqual(result.data.pagination, { page: 1, limit: 1, total: 1, totalPages: 1 })
  assert.equal(result.data.items[0].lectureCount, 1)
  assert.equal(result.data.items[0].sheetCount, 1)
  assert.equal(result.data.items[0].uploadCount, 1)

  const missing = await api('/admin/users/not-a-user', { token: admin.data.accessToken })
  assert.equal(missing.response.status, 404)
})

test('editing permits only validated profile fields and creates a secret-free audit log', async () => {
  const admin = await login('adminalpha', 'Admin@1234')
  for (const body of [{ role: 'ADMIN' }, { password: 'Changed123!' }, { email: 'other@example.test' }, { displayName: 'x' }]) {
    const rejected = await api('/admin/users/managed-user', { method: 'PATCH', token: admin.data.accessToken, body })
    assert.equal(rejected.response.status, 400)
  }
  const updated = await api('/admin/users/managed-user', {
    method: 'PATCH', token: admin.data.accessToken,
    body: { displayName: 'Managed Student', bio: 'Safe public biography', program: 'IT', cohort: '67', profilePublic: false, showProgram: false, showCohort: true }
  })
  assert.equal(updated.response.status, 200)
  assert.equal(updated.data.displayName, 'Managed Student')
  assert.equal(db.prepare("SELECT role FROM users WHERE id='managed-user'").get().role, 'USER')
  const detail = await api('/admin/users/managed-user', { token: admin.data.accessToken })
  assert.equal(detail.data.audit[0].action, 'USER_UPDATED')
  const serialized = JSON.stringify(detail.data.audit[0])
  assert.doesNotMatch(serialized, /password|token|secret/i)
})

test('soft deactivation revokes sessions, blocks auth, preserves attribution, and is auditable', async () => {
  const admin = await login('adminalpha', 'Admin@1234')
  const userSession = await login('manageduser', 'User@1234')
  const cookie = userSession.cookie.split(';')[0]
  const result = await api('/admin/users/managed-user/status', {
    method: 'PATCH', token: admin.data.accessToken,
    body: { status: 'DEACTIVATED', reason: 'Requested after account security review' }
  })
  assert.equal(result.response.status, 200)
  assert.equal(result.data.accountStatus, 'DEACTIVATED')
  assert.equal((await api('/contributors/me/settings', { token: userSession.data.accessToken })).response.status, 403)
  assert.equal((await api('/auth/refresh', { method: 'POST', cookie })).response.status, 401)
  assert.equal((await api('/auth/login', { method: 'POST', body: { usernameOrEmail: 'manageduser', password: 'User@1234' } })).response.status, 403)
  assert.equal(db.prepare("SELECT COUNT(*) count FROM lectures WHERE uploader_id='managed-user'").get().count, 1)
  assert.equal(db.prepare("SELECT COUNT(*) count FROM sheets WHERE uploader_id='managed-user'").get().count, 1)
  assert.equal(db.prepare("SELECT COUNT(*) count FROM upload_requests WHERE user_id='managed-user'").get().count, 1)
  assert.equal(db.prepare("SELECT action FROM admin_audit_logs WHERE target_user_id='managed-user' ORDER BY created_at DESC LIMIT 1").get().action, 'USER_DEACTIVATED')

  const restored = await api('/admin/users/managed-user/status', { method: 'PATCH', token: admin.data.accessToken, body: { status: 'ACTIVE' } })
  assert.equal(restored.response.status, 200)
  assert.equal((await login('manageduser', 'User@1234')).response.status, 200)
})

test('self-deactivation and last-active-admin deactivation are rejected', async () => {
  const admin = await login('adminalpha', 'Admin@1234')
  const self = await api('/admin/users/admin-a/status', { method: 'PATCH', token: admin.data.accessToken, body: { status: 'DEACTIVATED', reason: 'Should never be accepted' } })
  assert.equal(self.response.status, 409)
  db.prepare("UPDATE users SET account_status='DEACTIVATED' WHERE id='admin-b'").run()
  await assert.rejects(
    changeUserStatus({ actorId: 'admin-b', targetId: 'admin-a', body: { status: 'DEACTIVATED', reason: 'Would remove the final administrator' } }),
    /last active administrator/i
  )
  assert.equal(db.prepare("SELECT account_status FROM users WHERE id='admin-a'").get().account_status, 'ACTIVE')
})
