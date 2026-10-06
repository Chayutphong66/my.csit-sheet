import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'

// Never use DATABASE_URL or a production endpoint as an integration-test default.
test('dedicated local PostgreSQL: migrations, transactions, auth, files and concurrent revisions', { skip: !process.env.TEST_DATABASE_URL && 'TEST_DATABASE_URL NOT PROVIDED' }, async () => {
  const url = new URL(process.env.TEST_DATABASE_URL)
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Only a dedicated local test database is allowed in Phase 1')
  assert.match(url.pathname, /test/i, 'Test database name must contain test')
  process.env.NODE_ENV = 'test'; process.env.DATABASE_DRIVER = 'postgres'
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; process.env.STORAGE_DRIVER = 'database'
  const { default: pg } = await import('pg')
  const { applyPostgresMigrations } = await import('../src/data/postgresMigrations.js')
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 3, connectionTimeoutMillis: 5000 })
  let server; let closeDatabase
  try {
    const existing = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    assert.equal(existing.rows.length, 0, 'Refusing to alter a non-empty test database; provide a fresh dedicated database')
    const migrations = await Promise.all([applyPostgresMigrations(pool), applyPostgresMigrations(pool)])
    assert.equal(migrations.flat().length, 2)
    assert.deepEqual(await applyPostgresMigrations(pool), [])
    const database = await import('../src/data/databaseClient.js'); closeDatabase = database.closeDatabase
    const { db, withTransaction } = database
    await database.checkDatabaseConnection()
    await assert.rejects(withTransaction(async () => { await db.prepare("INSERT INTO courses(id,name) VALUES('rolled-back','fixture')").run(); throw new Error('rollback') }))
    assert.equal(await db.prepare("SELECT id FROM courses WHERE id='rolled-back'").get(), undefined)
    const { default: app } = await import('../src/app.js')
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}/api`
    async function api(route, { method = 'GET', body, token, cookie } = {}) {
      const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
      return { status: response.status, data: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
    }
    assert.equal((await api('/health')).status, 200)
    const credentials = { username: 'postgresfixture', email: 'fixture@example.invalid', password: 'FixturePassword123', program: 'CS', cohort: '66' }
    assert.equal((await api('/auth/register', { method: 'POST', body: credentials })).status, 201)
    assert.equal((await api('/auth/register', { method: 'POST', body: credentials })).status, 409)
    const stored = await db.prepare('SELECT id,password FROM users WHERE username=?').get(credentials.username)
    assert.match(stored.password, /^scrypt\$/)
    const login = await api('/auth/login', { method: 'POST', body: { usernameOrEmail: credentials.username, password: credentials.password } })
    assert.equal(login.status, 200)
    const refreshes = await Promise.all([1, 2].map(() => api('/auth/refresh', { method: 'POST', cookie: login.cookie })))
    assert.deepEqual(refreshes.map(result => result.status).sort(), [200, 401])
    const refreshed = refreshes.find(result => result.status === 200)
    assert.equal((await api('/auth/logout', { method: 'POST', cookie: refreshed.cookie })).status, 204)
    assert.equal((await api('/auth/refresh', { method: 'POST', cookie: refreshed.cookie })).status, 401)
    const crypto = await import('node:crypto')
    const { hashPassword } = await import('../src/services/password.service.js')
    const { createUser } = await import('../src/repositories/user.repository.js')
    const admin = await createUser({ id: crypto.randomUUID(), username: 'pgfixtureadmin', email: 'admin@example.invalid', password: hashPassword('FixtureAdmin123'), role: 'ADMIN' })
    await db.prepare("INSERT INTO courses(id,name,code) VALUES('pg-course','Postgres Fixture','PG101')").run()
    const { createUploadRequest, publishUploadRequest } = await import('../src/repositories/uploadRequest.repository.js')
    const bytes = Buffer.from('%PDF-1.4\nPG integration fixture\n%%EOF')
    const request = await createUploadRequest({ userId: stored.id, title: 'Postgres Fixture', fileName: 'pg.pdf', fileType: 'application/pdf', fileData: bytes, fileSize: bytes.length, courseId: 'pg-course', documentType: 'Lecture', academicYear: '2569', semester: '1', programId: 'program-cs' })
    const published = await Promise.all([1, 2].map(() => publishUploadRequest(request.id, { adminId: admin.id })))
    assert.equal(published[0].lectureId, published[1].lectureId)
    assert.equal((await db.prepare('SELECT COUNT(*) count FROM lectures WHERE source_request_id=?').get(request.id)).count, '1')
    const versions = await import('../src/repositories/documentVersion.repository.js')
    const pending = await Promise.all(['A', 'B'].map(text => {
      const fileData = Buffer.from(`%PDF-1.4\nPG revision ${text}\n%%EOF`)
      return versions.submitRevision({ documentType: 'Lecture', documentId: published[0].lectureId, submittedBy: stored.id, revisionType: 'UPDATE_DOCUMENT', changeSummary: 'Postgres concurrent revision', originalFileName: `${text}.pdf`, mimeType: 'application/pdf', fileData, sha256: crypto.createHash('sha256').update(fileData).digest('hex') })
    }))
    const approved = await Promise.all(pending.map(version => versions.approveRevision(version.id, admin.id)))
    assert.deepEqual(approved.map(version => version.versionNumber).sort(), [2, 3])
    const file = await versions.findVersionFile(approved[0].id)
    assert.ok(Buffer.from(file.fileData).toString().includes('PG revision'))
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    if (closeDatabase) await closeDatabase()
    await pool.end()
    // Intentionally leave test data for inspection; never drop/reset a database.
  }
})
