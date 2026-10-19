import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import { readdir } from 'node:fs/promises'
import { migrationDirectory } from '../src/data/postgresMigrations.js'
import { verifyPostgresFeedback } from './support/postgresFeedback.integration.js'

// Never use DATABASE_URL or a production endpoint as an integration-test default.
test('dedicated local PostgreSQL: migrations, constraints, transactions and concurrency guards', { skip: !process.env.TEST_DATABASE_URL && 'TEST_DATABASE_URL NOT PROVIDED' }, async () => {
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
    const expectedMigrations = (await readdir(migrationDirectory)).filter(name => /^\d+.*\.sql$/.test(name)).sort()
    assert.ok(expectedMigrations.length >= 2, 'Canonical migration set must not unexpectedly shrink')
    const migrations = await Promise.all([applyPostgresMigrations(pool), applyPostgresMigrations(pool)])
    assert.deepEqual(migrations.flat().sort(), expectedMigrations, 'Concurrent runners must apply every canonical migration exactly once')
    assert.deepEqual(await applyPostgresMigrations(pool), [])
    const ledger = (await pool.query('SELECT name,checksum FROM app_schema_migrations ORDER BY name')).rows
    assert.deepEqual(ledger.map(row => row.name), expectedMigrations)
    assert.ok(ledger.every(row => /^[a-f0-9]{64}$/.test(row.checksum)), 'Migration ledger must retain SHA-256 checksums')
    await pool.query("UPDATE app_schema_migrations SET checksum=repeat('0',64) WHERE name=$1", [ledger[0].name])
    await assert.rejects(applyPostgresMigrations(pool), /history differs from canonical files/)
    await pool.query('UPDATE app_schema_migrations SET checksum=$1 WHERE name=$2', [ledger[0].checksum, ledger[0].name])
    await assert.rejects(
      pool.query("INSERT INTO users(id,username,email,password,role) VALUES('bad-role','bad-role','bad-role@example.invalid','x','ROOT')"),
      error => error.code === '23514'
    )
    await assert.rejects(
      pool.query("INSERT INTO program_courses(program_id,course_id) VALUES('missing-program','missing-course')"),
      error => error.code === '23503'
    )
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
    await db.prepare("INSERT INTO program_courses(program_id,course_id) VALUES('program-cs','pg-course')").run()
    await db.prepare("INSERT INTO course_offerings(id,course_id,academic_year,semester) VALUES('pg-offering','pg-course','2569','1')").run()
    await db.prepare("INSERT INTO course_offering_programs(offering_id,program_id) VALUES('pg-offering','program-cs')").run()
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

    const dedupBytes = Buffer.from('%PDF-1.4\nPG concurrent dedup fixture\n%%EOF')
    const dedupHash = crypto.createHash('sha256').update(dedupBytes).digest('hex')
    const duplicateRequests = await Promise.all([1, 2].map(index => createUploadRequest({
      userId: stored.id, title: 'Concurrent dedup fixture', fileName: `dedup-${index}.pdf`, fileType: 'application/pdf',
      fileData: dedupBytes, fileSize: dedupBytes.length, courseId: 'pg-course', documentType: 'Lecture',
      academicYear: '2569', semester: '1', programId: 'program-cs'
    })))
    assert.deepEqual(duplicateRequests.map(item => item.duplicateStatus).sort(), ['EXACT_DUPLICATE', 'NONE'])
    assert.equal((await db.prepare('SELECT COUNT(*) count FROM file_assets WHERE binary_hash=?').get(dedupHash)).count, '1')

    const collections = await import('../src/repositories/collection.repository.js')
    const actor = { id: stored.id, role: 'USER' }
    let ordered = await collections.createCollection(stored.id, { name: 'Postgres concurrent ordering', collectionType: 'MIXED' })
    ordered = await collections.createSection(ordered.id, actor, { title: 'Alpha' })
    ordered = await collections.createSection(ordered.id, actor, { title: 'Beta' })
    const sectionIds = ordered.sections.map(section => section.id)
    const orderResults = await Promise.allSettled([sectionIds, [...sectionIds].reverse()].map(sections => collections.saveCollectionOrder(ordered.id, actor, {
      expectedVersion: ordered.version, sections, documents: []
    })))
    assert.deepEqual(orderResults.map(result => result.status).sort(), ['fulfilled', 'rejected'])
    assert.equal(orderResults.find(result => result.status === 'rejected').reason.status, 409)
    assert.equal(Number((await db.prepare('SELECT version FROM collections WHERE id=?').get(ordered.id)).version), ordered.version + 1)

    await db.prepare("INSERT INTO courses(id,name,code) VALUES('pg-course-other','Other Postgres Fixture','PG202')").run()
    const bulk = await import('../src/services/bulkUpload.service.js')
    const failedJob = await bulk.createBulkUpload({ actorId: stored.id, actorRole: 'USER', body: {
      collectionId: ordered.id,
      sharedMetadata: { courseId: 'pg-course', programId: 'program-cs', documentType: 'Sheet', academicYear: '2569', semester: '1' },
      items: [{ clientKey: 'retry-race', title: 'Retry race', fileName: 'retry-race.pdf', fileType: 'application/pdf', fileData: dedupBytes.toString('base64'), courseId: 'missing-course' }]
    } })
    assert.equal(failedJob.status, 'FAILED')
    const retryBody = { sharedMetadata: { courseId: 'pg-course', programId: 'program-cs', documentType: 'Sheet', academicYear: '2569', semester: '1' }, items: [{ clientKey: 'retry-race', title: 'Retry recovered', fileName: 'retry-recovered.pdf', fileType: 'application/pdf', fileData: Buffer.from('%PDF-1.4\nretry recovered\n%%EOF').toString('base64') }] }
    const retryResults = await Promise.allSettled([1, 2].map(() => bulk.retryBulkUpload({ id: failedJob.id, actorId: stored.id, actorRole: 'USER', body: retryBody })))
    assert.deepEqual(retryResults.map(result => result.status).sort(), ['fulfilled', 'rejected'])
    assert.equal(retryResults.find(result => result.status === 'rejected').reason.status, 409)
    const retried = await db.prepare('SELECT status,attempt_count attemptCount,request_id requestId FROM bulk_upload_items WHERE job_id=? AND client_key=?').get(failedJob.id, 'retry-race')
    assert.equal(retried.status, 'READY'); assert.equal(Number(retried.attemptCount), 2); assert.ok(retried.requestId)

    await verifyPostgresFeedback({
      api, db, pool, withTransaction,
      reporter: stored,
      reporterToken: login.data.accessToken,
      admin,
      adminCredentials: { usernameOrEmail: 'pgfixtureadmin', password: 'FixtureAdmin123' },
      approvedDocument: { type: 'Lecture', id: published[0].lectureId }
    })

    const secondAdmin = await createUser({ id: crypto.randomUUID(), username: 'pgfixtureadmin2', email: 'admin2@example.invalid', password: hashPassword('FixtureAdmin123'), role: 'ADMIN' })
    const { changeUserStatus } = await import('../src/services/adminUser.service.js')
    const adminResults = await Promise.allSettled([
      changeUserStatus({ actorId: admin.id, targetId: secondAdmin.id, body: { status: 'DEACTIVATED', reason: 'Postgres concurrency verification' } }),
      changeUserStatus({ actorId: secondAdmin.id, targetId: admin.id, body: { status: 'DEACTIVATED', reason: 'Postgres concurrency verification' } })
    ])
    assert.deepEqual(adminResults.map(result => result.status).sort(), ['fulfilled', 'rejected'])
    assert.match(adminResults.find(result => result.status === 'rejected').reason.message, /last active administrator/i)
    assert.equal(Number((await db.prepare("SELECT COUNT(*) count FROM users WHERE role='ADMIN' AND account_status='ACTIVE'").get()).count), 1)

  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    if (closeDatabase) await closeDatabase()
    await pool.end()
    // Intentionally leave test data for inspection; never drop/reset a database.
  }
})
