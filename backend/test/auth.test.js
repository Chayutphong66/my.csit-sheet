import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-auth-tests'
process.env.DATABASE_PATH = path.join(tmpdir(), `csit-sheet-auth-${process.pid}-${Date.now()}.sqlite`)

mkdirSync(path.dirname(process.env.DATABASE_PATH), { recursive: true })

const { default: app } = await import('../src/app.js')
const { db } = await import('../src/data/database.js')
const { supportedCohorts } = await import('../src/services/communityIdentity.service.js')

const server = app.listen(0)
const baseUrl = `http://127.0.0.1:${server.address().port}/api`

test.after(() => {
  server.close()
  db.close()
})

async function request(pathname, { method = 'POST', body, cookie, accessToken } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })

  const text = await response.text()
  return {
    response,
    data: text ? JSON.parse(text) : null,
    cookie: response.headers.get('set-cookie')
  }
}

function refreshCookie(setCookie) {
  return setCookie.split(';')[0]
}

test('registration validates input', async () => {
  const { response, data } = await request('/auth/register', {
    body: { username: 'ab', email: 'not-an-email', password: 'short' }
  })

  assert.equal(response.status, 400)
  assert.match(data.message, /username/i)
})

test('registered passwords are hashed and login issues an httpOnly refresh cookie', async () => {
  const credentials = {
    username: 'secureuser',
    email: 'secureuser@example.com',
    password: 'CorrectHorse123',
    program: 'CS',
    cohort: '66'
  }

  const registerResult = await request('/auth/register', { body: credentials })
  assert.equal(registerResult.response.status, 201)

  const row = db.prepare('SELECT password, program_code, cohort FROM users WHERE username = ?').get(credentials.username)
  assert.notEqual(row.password, credentials.password)
  assert.match(row.password, /^scrypt\$/)
  assert.equal(row.program_code, 'CS')
  assert.equal(row.cohort, '66')

  const loginResult = await request('/auth/login', {
    body: { usernameOrEmail: credentials.email, password: credentials.password }
  })

  assert.equal(loginResult.response.status, 200)
  assert.ok(loginResult.data.accessToken)
  assert.equal(loginResult.data.user.password, undefined)
  assert.equal(loginResult.data.user.program, 'CS')
  assert.equal(loginResult.data.user.cohort, '66')
  assert.match(loginResult.cookie, /HttpOnly/i)
  assert.match(loginResult.cookie, /SameSite=Lax/i)
  assert.match(loginResult.cookie, /Path=\/api\/auth/i)
})

test('registration requires a supported program and current Buddhist Era cohort', async () => {
  const base = { username: 'identityuser', email: 'identity@example.com', password: 'CorrectHorse123' }
  assert.equal((await request('/auth/register', { body: { ...base, cohort: '66' } })).response.status, 400)
  assert.equal((await request('/auth/register', { body: { ...base, program: 'IT' } })).response.status, 400)
  assert.equal((await request('/auth/register', { body: { ...base, program: 'ABC', cohort: '66' } })).response.status, 400)
  assert.equal((await request('/auth/register', { body: { ...base, program: 'IT', cohort: '99' } })).response.status, 400)
  assert.equal((await request('/auth/register', { body: { ...base, program: 'IT', cohort: '<script>' } })).response.status, 400)

  const valid = await request('/auth/register', { body: { ...base, program: 'IT', cohort: '69' } })
  assert.equal(valid.response.status, 201)
  const identity = db.prepare('SELECT program_code, cohort FROM users WHERE username=?').get(base.username)
  assert.equal(identity.program_code, 'IT')
  assert.equal(identity.cohort, '69')
})

test('cohort options grow automatically with the Buddhist Era year', () => {
  assert.deepEqual(supportedCohorts(new Date('2026-06-01T00:00:00Z')), ['66', '67', '68', '69'])
  assert.deepEqual(supportedCohorts(new Date('2027-06-01T00:00:00Z')), ['66', '67', '68', '69', '70'])
})

test('demo users still log in after hashed seed migration', async () => {
  const result = await request('/auth/login', {
    body: { usernameOrEmail: 'admin', password: 'Admin@1234' }
  })

  assert.equal(result.response.status, 200)
  assert.equal(result.data.user.role, 'ADMIN')
})

test('incorrect password fails login', async () => {
  const result = await request('/auth/login', {
    body: { usernameOrEmail: 'admin', password: 'WrongPassword123' }
  })

  assert.equal(result.response.status, 401)
  assert.equal(result.data.accessToken, undefined)
  assert.equal(result.cookie, null)
})

test('refresh tokens rotate and cannot be reused', async () => {
  const loginResult = await request('/auth/login', {
    body: { usernameOrEmail: 'student01', password: 'User@1234' }
  })
  const firstCookie = refreshCookie(loginResult.cookie)

  const firstRefresh = await request('/auth/refresh', { cookie: firstCookie })
  assert.equal(firstRefresh.response.status, 200)
  const secondCookie = refreshCookie(firstRefresh.cookie)
  assert.notEqual(secondCookie, firstCookie)

  const reused = await request('/auth/refresh', { cookie: firstCookie })
  assert.equal(reused.response.status, 401)

  const activeRows = db
    .prepare('SELECT token_hash, revoked_at FROM refresh_tokens WHERE user_id = ? ORDER BY created_at')
    .all('2')
  assert.ok(activeRows.every((row) => !row.token_hash.includes('refreshToken=')))
  assert.ok(activeRows.some((row) => row.revoked_at))

  const secondRefresh = await request('/auth/refresh', { cookie: secondCookie })
  assert.equal(secondRefresh.response.status, 200)
})

test('logout revokes the refresh token', async () => {
  const loginResult = await request('/auth/login', {
    body: { usernameOrEmail: 'student02', password: 'User@1234' }
  })
  const cookie = refreshCookie(loginResult.cookie)

  const logoutResult = await request('/auth/logout', { cookie })
  assert.equal(logoutResult.response.status, 204)

  const refreshResult = await request('/auth/refresh', { cookie })
  assert.equal(refreshResult.response.status, 401)
})

test('USER cannot access ADMIN-only routes', async () => {
  const loginResult = await request('/auth/login', {
    body: { usernameOrEmail: 'student01', password: 'User@1234' }
  })

  const adminResult = await request('/admin/users', {
    method: 'GET',
    body: undefined,
    cookie: undefined,
    accessToken: loginResult.data.accessToken
  })

  assert.equal(adminResult.response.status, 403)
})

test('duplicate usernames/emails and concurrent registration return safe conflicts', async () => {
  const body = { username: 'concurrentuser', email: 'concurrent@example.com', password: 'CorrectHorse123', program: 'IT', cohort: '66' }
  const results = await Promise.all([request('/auth/register', { body }), request('/auth/register', { body })])
  assert.deepEqual(results.map(result => result.response.status).sort(), [201, 409])
  assert.equal((await request('/auth/register', { body: { ...body, username: 'differentuser' } })).response.status, 409)
  assert.equal((await request('/auth/register', { body: { ...body, email: 'different@example.com' } })).response.status, 409)
  assert.equal(db.prepare('SELECT COUNT(*) count FROM users WHERE username=?').get(body.username).count, 1)
})

test('registration SQL failure leaves no user and exposes no internal error', async () => {
  db.exec("CREATE TRIGGER registration_failure BEFORE INSERT ON users WHEN NEW.username='faileduser' BEGIN SELECT RAISE(ABORT,'private registration SQL failure'); END")
  try {
    const result = await request('/auth/register', { body: { username: 'faileduser', email: 'failed@example.com', password: 'CorrectHorse123', program: 'CS', cohort: '66' } })
    assert.equal(result.response.status, 500)
    assert.equal(result.data.message, 'Internal server error')
    assert.equal(db.prepare("SELECT id FROM users WHERE username='faileduser'").get(), undefined)
  } finally { db.exec('DROP TRIGGER registration_failure') }
})

test('expired refresh sessions are rejected and logout clears matching cookie attributes', async () => {
  const login = await request('/auth/login', { body: { usernameOrEmail: 'student01', password: 'User@1234' } })
  const cookie = refreshCookie(login.cookie)
  db.prepare("UPDATE refresh_tokens SET expires_at='2000-01-01 00:00:00' WHERE user_id='2' AND revoked_at IS NULL").run()
  assert.equal((await request('/auth/refresh', { cookie })).response.status, 401)
  const logout = await request('/auth/logout', { cookie })
  assert.equal(logout.response.status, 204)
  assert.match(logout.cookie, /HttpOnly/); assert.match(logout.cookie, /SameSite=Lax/); assert.match(logout.cookie, /Path=\/api\/auth/)
})
