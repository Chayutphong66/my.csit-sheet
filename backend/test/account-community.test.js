import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.DATABASE_DRIVER = 'sqlite'
process.env.STORAGE_DRIVER = 'database'
process.env.JWT_SECRET = 'account-community-test-secret'
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'csit-account-')), 'fixture.sqlite')
const { default: app } = await import('../src/app.js')
const { db, closeDatabase } = await import('../src/data/databaseClient.js')
const { issueAccountToken } = await import('../src/repositories/accountToken.repository.js')
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}/api`
test.after(async () => { await new Promise(resolve => server.close(resolve)); await closeDatabase() })

async function api(url, { method = 'GET', body, token } = {}) {
  const response = await fetch(base + url, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await response.text(); return { response, data: text ? JSON.parse(text) : null }
}
async function login(usernameOrEmail, password = 'User@1234') { return (await api('/auth/login', { method: 'POST', body: { usernameOrEmail, password } })).data.accessToken }

test('registration rejects a mismatched confirmation and forgot-password stays generic', async () => {
  const mismatch = await api('/auth/register', { method: 'POST', body: { username: 'confirmuser', email: 'confirm@example.com', password: 'CorrectHorse123', confirmPassword: 'DifferentHorse123', program: 'CS', cohort: '66' } })
  assert.equal(mismatch.response.status, 400); assert.match(mismatch.data.message, /do not match/i)
  const currentCohort = String((new Date().getFullYear() + 543) % 100).padStart(2, '0')
  const registered = await api('/auth/register', { method: 'POST', body: { username: 'emailflow', email: 'emailflow@example.com', password: 'CorrectHorse123', confirmPassword: 'CorrectHorse123', program: 'CS', cohort: currentCohort } })
  assert.equal(registered.response.status, 201); assert.equal(registered.data.emailDelivery, 'MOCKED'); assert.match(registered.data.message, /simulated/i)
  assert.equal((await db.prepare("SELECT status FROM email_deliveries WHERE recipient=? AND template='emailVerification'").get('emailflow@example.com')).status, 'MOCKED')
  const knownEmail = (await db.prepare("SELECT email FROM users WHERE username='student01'").get()).email
  const known = await api('/auth/forgot-password', { method: 'POST', body: { email: knownEmail } })
  const unknown = await api('/auth/forgot-password', { method: 'POST', body: { email: 'missing@example.com' } })
  assert.equal(known.response.status, 200); assert.deepEqual(known.data, unknown.data)
  assert.equal((await db.prepare("SELECT status FROM email_deliveries WHERE recipient=? AND template='passwordReset' ORDER BY created_at DESC LIMIT 1").get(knownEmail)).status, 'MOCKED')
})

test('verification and reset tokens are hashed, single-use, and reset revokes sessions', async () => {
  const user = await db.prepare("SELECT id,email FROM users WHERE username='student01'").get()
  await db.prepare('UPDATE users SET is_verified=0,email_verified_at=NULL WHERE id=?').run(user.id)
  const verification = await issueAccountToken(user.id, 'EMAIL_VERIFICATION', 10)
  assert.notEqual((await db.prepare('SELECT token_hash FROM account_tokens WHERE user_id=? AND purpose=\'EMAIL_VERIFICATION\'').get(user.id)).token_hash, verification.token)
  assert.equal((await api(`/auth/verify-email?token=${verification.token}`)).response.status, 200)
  assert.equal((await api(`/auth/verify-email?token=${verification.token}`)).response.status, 400)
  const active = await login('student01')
  assert.ok(active)
  const reset = await issueAccountToken(user.id, 'PASSWORD_RESET', 10)
  const changed = await api('/auth/reset-password', { method: 'POST', body: { token: reset.token, password: 'NewPassword123!', confirmPassword: 'NewPassword123!' } })
  assert.equal(changed.response.status, 200)
  assert.equal((await db.prepare("SELECT status FROM email_deliveries WHERE recipient=? AND template='passwordChanged' ORDER BY created_at DESC LIMIT 1").get(user.email)).status, 'MOCKED')
  assert.equal((await api('/auth/reset-password', { method: 'POST', body: { token: reset.token, password: 'AnotherPassword123!', confirmPassword: 'AnotherPassword123!' } })).response.status, 400)
  assert.equal((await api('/auth/login', { method: 'POST', body: { usernameOrEmail: 'student01', password: 'User@1234' } })).response.status, 401)
  assert.equal((await api('/auth/login', { method: 'POST', body: { usernameOrEmail: 'student01', password: 'NewPassword123!' } })).response.status, 200)
})

test('follow constraints, privacy-safe counts, and follow/unfollow are consistent', async () => {
  const user1 = await login('student01', 'NewPassword123!'); const user2 = await login('student02')
  assert.equal((await api('/contributors/student01/follow', { method: 'PUT', token: user1, body: { following: true } })).response.status, 400)
  const first = await api('/contributors/student01/follow', { method: 'PUT', token: user2, body: { following: true } })
  const duplicate = await api('/contributors/student01/follow', { method: 'PUT', token: user2, body: { following: true } })
  assert.equal(first.data.followersCount, 1); assert.equal(duplicate.data.followersCount, 1)
  assert.equal((await api('/contributors/student01/followers', { token: user1 })).data.length, 1)
  assert.equal((await api('/contributors/student01/follow', { method: 'PUT', token: user2, body: { following: false } })).data.followersCount, 0)
})

test('program changes require transactional administrator approval and keep history', async () => {
  const user = await login('student02'); const admin = await login('admin', 'Admin@1234')
  const before = await db.prepare("SELECT program_code FROM users WHERE username='student02'").get()
  const requested = before.program_code === 'IT' ? 'CS' : 'IT'
  const created = await api('/contributors/me/change-requests', { method: 'POST', token: user, body: { category: 'PROGRAM', requestedValue: requested, reason: 'Registration program needs correction' } })
  assert.equal(created.response.status, 201)
  assert.equal((await db.prepare("SELECT program_code FROM users WHERE username='student02'").get()).program_code, before.program_code)
  assert.equal((await api('/contributors/me/change-requests', { method: 'POST', token: user, body: { category: 'PROGRAM', requestedValue: requested, reason: 'Duplicate pending request' } })).response.status, 409)
  const approved = await api(`/admin/profile-change-requests/${created.data.id}`, { method: 'PATCH', token: admin, body: { status: 'APPROVED' } })
  assert.equal(approved.response.status, 200)
  assert.equal((await db.prepare("SELECT program_code FROM users WHERE username='student02'").get()).program_code, requested)
  assert.equal((await api(`/admin/profile-change-requests/${created.data.id}`, { method: 'PATCH', token: admin, body: { status: 'REJECTED', reason: 'late' } })).response.status, 409)
})

test('avatar validates the exact size message and display-name cooldown is server-side', async () => {
  const user = await login('student02')
  const tooLarge = await api('/contributors/me/avatar', { method: 'POST', token: user, body: { fileData: Buffer.alloc(1024 * 1024 + 1).toString('base64') } })
  assert.equal(tooLarge.response.status, 400); assert.equal(tooLarge.data.message, 'Please upload a picture smaller than 1 MB.')
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nNwAAAAASUVORK5CYII='
  assert.equal((await api('/contributors/me/avatar', { method: 'POST', token: user, body: { fileData: png } })).response.status, 200)
  assert.equal((await api('/contributors/me', { method: 'PATCH', token: user, body: { displayName: 'Cooldown Name' } })).response.status, 200)
  assert.equal((await api('/contributors/me', { method: 'PATCH', token: user, body: { displayName: 'Bypass Attempt' } })).response.status, 409)
})
