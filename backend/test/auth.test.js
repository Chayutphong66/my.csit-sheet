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
    password: 'CorrectHorse123'
  }

  const registerResult = await request('/auth/register', { body: credentials })
  assert.equal(registerResult.response.status, 201)

  const row = db.prepare('SELECT password FROM users WHERE username = ?').get(credentials.username)
  assert.notEqual(row.password, credentials.password)
  assert.match(row.password, /^scrypt\$/)

  const loginResult = await request('/auth/login', {
    body: { usernameOrEmail: credentials.email, password: credentials.password }
  })

  assert.equal(loginResult.response.status, 200)
  assert.ok(loginResult.data.accessToken)
  assert.equal(loginResult.data.user.password, undefined)
  assert.match(loginResult.cookie, /HttpOnly/i)
  assert.match(loginResult.cookie, /SameSite=Lax/i)
  assert.match(loginResult.cookie, /Path=\/api\/auth/i)
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
