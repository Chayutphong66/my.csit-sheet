import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { once } from 'node:events'
import { toPostgresQuery } from '../src/data/postgresSql.js'
import { requiredSchema, verifySchema } from '../src/data/schemaRequirements.js'
import { applyPostgresMigrations } from '../src/data/postgresMigrations.js'
import { inspectSqlite, transferSqlite } from '../src/data/sqliteTransfer.js'
import { attachGracefulShutdown } from '../src/services/serverLifecycle.js'

process.env.NODE_ENV = 'test'
process.env.DATABASE_DRIVER = 'sqlite'
process.env.STORAGE_DRIVER = 'database'
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'csit-infra-')), 'fixture.sqlite')
const { loadConfiguration, validateAuthentication } = await import('../src/config/environment.js')
const { default: app } = await import('../src/app.js')
const { db, withTransaction, closeDatabase } = await import('../src/data/databaseClient.js')
const { createStorageAdapter } = await import('../src/services/storageAdapter.js')
const { createRefreshToken, consumeRefreshToken } = await import('../src/services/token.service.js')
const server = app.listen(0, '127.0.0.1')
await once(server, 'listening')
const baseUrl = `http://127.0.0.1:${server.address().port}`
test.after(async () => { await new Promise(resolve => server.close(resolve)); await closeDatabase() })

test('configuration is explicit, bounded, provider neutral and fails closed', () => {
  assert.equal(loadConfiguration({ NETLIFY: 'true', NETLIFY_DB_URL: 'ignored' }).databaseDriver, 'sqlite')
  assert.throws(() => loadConfiguration({ NODE_ENV: 'prod' }), /NODE_ENV/)
  assert.throws(() => loadConfiguration({ DATABASE_DRIVER: 'postgres' }), /DATABASE_URL is required/)
  assert.throws(() => loadConfiguration({ DATABASE_DRIVER: 'postgres', DATABASE_URL: 'invalid' }), /valid PostgreSQL/)
  assert.throws(() => loadConfiguration({ NODE_ENV: 'production', DATABASE_DRIVER: 'sqlite' }), /Production requires/)
  assert.throws(() => loadConfiguration({ STORAGE_DRIVER: 'invalid' }), /STORAGE_DRIVER/)
  assert.throws(() => loadConfiguration({ STORAGE_DRIVER: 'supabase' }), /SUPABASE_URL/)
  assert.throws(() => loadConfiguration({ STORAGE_DRIVER: 'supabase', SUPABASE_URL: 'http://fixture.invalid' }), /valid HTTPS/)
  assert.throws(() => loadConfiguration({ STORAGE_DRIVER: 'supabase', SUPABASE_URL: 'https://fixture.supabase.co' }), /SUPABASE_SECRET_KEY/)
  assert.throws(() => loadConfiguration({ STORAGE_DRIVER: 'supabase', SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SECRET_KEY: 'fixture' }), /SUPABASE_STORAGE_BUCKET/)
  assert.throws(() => loadConfiguration({ DATABASE_POOL_MAX: '51' }), /DATABASE_POOL_MAX/)
  assert.throws(() => loadConfiguration({ SMTP_SECURE: 'yes' }), /SMTP_SECURE must be true or false/)
  assert.throws(() => loadConfiguration({ EMAIL_VERIFICATION_ENFORCED: 'yes' }), /EMAIL_VERIFICATION_ENFORCED must be true or false/)
  assert.throws(() => loadConfiguration({ ALLOWED_ORIGINS: '*' }), /explicit HTTP/)
  assert.throws(() => loadConfiguration({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://localhost/test',
    STORAGE_DRIVER: 'supabase',
    SUPABASE_URL: 'https://fixture.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_fixture-server-only-key',
    SUPABASE_STORAGE_BUCKET: 'documents',
    RAILWAY_PUBLIC_DOMAIN: 'https://invalid.example'
  }), /RAILWAY_PUBLIC_DOMAIN/)
  assert.throws(() => loadConfiguration({ COOKIE_SAME_SITE: 'none' }), /HTTPS/)
  assert.equal(loadConfiguration({ SUPABASE_SECRET_KEY: 'current-secret', SUPABASE_SERVICE_ROLE_KEY: 'legacy-secret' }).storageKey, 'current-secret')
  assert.equal(loadConfiguration({ SUPABASE_SERVICE_ROLE_KEY: 'legacy-secret' }).storageKey, 'legacy-secret')
  const gmail = loadConfiguration({
    SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '465', SMTP_SECURE: 'true',
    SMTP_USER: 'sender@example.com', SMTP_PASS: 'fixture-app-password',
    MAIL_FROM: 'CSIT Sheet <sender@example.com>'
  })
  assert.equal(gmail.smtpHost, 'smtp.gmail.com'); assert.equal(gmail.smtpPort, 465); assert.equal(gmail.smtpSecure, true)
  assert.equal(gmail.smtpUser, 'sender@example.com'); assert.equal(gmail.smtpPass, 'fixture-app-password')
  assert.equal(gmail.mailFrom, 'CSIT Sheet <sender@example.com>')
  assert.throws(() => validateAuthentication(loadConfiguration({ EMAIL_VERIFICATION_ENFORCED: 'true' })), /complete SMTP configuration/)
  const production = loadConfiguration({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://localhost/test',
    ALLOWED_ORIGINS: 'https://mycsit-sheet.netlify.app',
    COOKIE_SAME_SITE: 'none',
    PORT: '4567',
    SUPABASE_URL: 'https://fixture.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_fixture-server-only-key',
    SUPABASE_STORAGE_BUCKET: 'documents'
  })
  assert.equal(production.host, '0.0.0.0'); assert.equal(production.port, 4567)
  assert.equal(production.cookieSecure, true); assert.equal(production.cookieSameSite, 'none')
  assert.throws(() => validateAuthentication(production), /JWT_SECRET/)
  const productionBootstrap = loadConfiguration({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://localhost/test',
    STORAGE_DRIVER: 'supabase',
    SUPABASE_URL: 'https://fixture.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_fixture-server-only-key',
    SUPABASE_STORAGE_BUCKET: 'documents'
  })
  assert.deepEqual(productionBootstrap.allowedOrigins, [])
  const railwayProduction = loadConfiguration({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://localhost/test',
    STORAGE_DRIVER: 'supabase',
    SUPABASE_URL: 'https://fixture.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_fixture-server-only-key',
    SUPABASE_STORAGE_BUCKET: 'documents',
    RAILWAY_PUBLIC_DOMAIN: 'my-csit-sheet.up.railway.app'
  })
  assert.deepEqual(railwayProduction.allowedOrigins, ['https://my-csit-sheet.up.railway.app'])
})

test('production startup reports missing configuration without touching SQLite', () => {
  const env = { ...process.env, NODE_ENV: 'production', DATABASE_DRIVER: 'postgres', DATABASE_URL: '', STORAGE_DRIVER: 'supabase' }
  const result = spawnSync(process.execPath, ['src/server.js'], { cwd: path.resolve(import.meta.dirname, '..'), env, encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /server.startup_failed/)
  assert.match(result.stderr, /DATABASE_URL is required/)
  assert.doesNotMatch(result.stderr, /node:sqlite/)
})

test('Postgres SQL binding preserves quoted data, comments, aliases and repeat named parameters', () => {
  const query = toPostgresQuery("SELECT '?' AS literal, '@name LIKE CURRENT_TIMESTAMP' AS label FROM users WHERE username LIKE ? -- ?\n", ['x%'])
  assert.match(query.sql, /username ILIKE \$1/)
  assert.match(query.sql, /'@name LIKE CURRENT_TIMESTAMP'/)
  assert.match(query.sql, /-- \?/)
  assert.deepEqual(query.parameters, ['x%'])
  const named = toPostgresQuery('SELECT @name, @name, @other', [{ name: 'value', other: 2 }])
  assert.equal(named.sql, 'SELECT $1, $1, $2'); assert.deepEqual(named.parameters, ['value', 2])
  assert.match(toPostgresQuery('INSERT OR IGNORE INTO programs(id) VALUES(?)', ['id']).sql, /ON CONFLICT DO NOTHING$/)
  assert.match(toPostgresQuery("SELECT group_concat(display_name, ', '), CURRENT_TIMESTAMP").sql, /string_agg/)
  assert.match(toPostgresQuery('SELECT CURRENT_TIMESTAMP').sql, /AT TIME ZONE 'UTC'/)
})

test('schema readiness checks every feature table and future storage references', () => {
  const rows = Object.entries(requiredSchema).flatMap(([table_name, columns]) => columns.map(column_name => ({ table_name, column_name })))
  assert.doesNotThrow(() => verifySchema(rows, false))
  assert.throws(() => verifySchema(rows), /storage_key/)
  assert.throws(() => verifySchema(rows.filter(row => row.table_name !== 'refresh_tokens'), false), /refresh_tokens/)
})

function fakeMigrationPool({ fail = false } = {}) {
  const history = []; const commands = []; let releases = 0; let pending
  const pool = { async connect() { return {
    async query(sql, values = []) {
      commands.push(sql)
      if (sql.startsWith('SELECT name, checksum')) return { rows: history.slice() }
      if (fail && sql.startsWith('CREATE TABLE users')) throw new Error('Simulated migration failure')
      if (sql === 'BEGIN') pending = []
      if (sql.startsWith('INSERT INTO app_schema_migrations')) pending.push({ name: values[0], checksum: values[1] })
      if (sql === 'COMMIT') history.push(...pending)
      if (sql === 'ROLLBACK') pending = []
      return { rows: [] }
    }, release() { releases++ }
  } } }
  return { pool, history, commands, get releases() { return releases } }
}

test('migration runner uses a session lock, ledger, checksums, transactions and repeat no-op', async () => {
  const fake = fakeMigrationPool()
  assert.deepEqual(await applyPostgresMigrations(fake.pool), ['001_initial_schema.sql', '002_storage_references.sql', '003_account_community_enhancements.sql'])
  assert.deepEqual(await applyPostgresMigrations(fake.pool), [])
  assert.equal(fake.releases, 2)
  assert.match(fake.commands[0], /pg_advisory_lock/)
  assert.match(fake.commands.at(-1), /pg_advisory_unlock/)
  assert.equal(fake.commands.filter(sql => sql === 'COMMIT').length, 3)
  fake.history[0].checksum = 'changed'
  await assert.rejects(applyPostgresMigrations(fake.pool), /history differs/)
  const failing = fakeMigrationPool({ fail: true })
  await assert.rejects(applyPostgresMigrations(failing.pool), /Simulated/)
  assert.equal(failing.history.length, 0)
  assert.ok(failing.commands.includes('ROLLBACK')); assert.equal(failing.releases, 1)
})

test('SQLite transactions serialize concurrent callers and roll back failed writes', async () => {
  await db.prepare('SELECT 1').get()
  const events = []
  await Promise.all([1, 2].map(id => withTransaction(async () => { events.push(`start${id}`); await Promise.resolve(); events.push(`end${id}`) })))
  assert.deepEqual(events, ['start1', 'end1', 'start2', 'end2'])
  await assert.rejects(withTransaction(async () => { await db.prepare("INSERT INTO courses(id,name) VALUES('rollback-test','rollback')").run(); throw new Error('rollback fixture') }))
  assert.equal(await db.prepare("SELECT id FROM courses WHERE id='rollback-test'").get(), undefined)
})

test('concurrent refresh consumes a stored hashed session exactly once', async () => {
  const user = await db.prepare('SELECT id FROM users LIMIT 1').get()
  const token = await createRefreshToken(user)
  const sessions = await Promise.all([consumeRefreshToken(token), consumeRefreshToken(token)])
  assert.equal(sessions.filter(Boolean).length, 1)
  const row = await db.prepare('SELECT token_hash FROM refresh_tokens ORDER BY created_at DESC LIMIT 1').get()
  assert.notEqual(row.token_hash, token)
})

test('local storage uses persistent SQLite bytes and rejects mismatched content keys', async () => {
  const adapter = createStorageAdapter(loadConfiguration({}))
  const bytes = Buffer.from('local storage fixture')
  const key = `sha256/${crypto.createHash('sha256').update(bytes).digest('hex')}`
  await adapter.save(key, bytes, { mimeType: 'text/plain', originalFilename: 'fixture.txt' })
  assert.deepEqual(await adapter.read(key), bytes)
  assert.equal(await adapter.exists(key), true)
  assert.equal((await adapter.metadata(key)).mimeType, 'text/plain')
  assert.deepEqual(await createStorageAdapter(loadConfiguration({})).read(key), bytes)
  await assert.rejects(adapter.save(key, Buffer.from('different')), /do not match/)
  await adapter.delete(key); assert.equal(await adapter.exists(key), false)
})

test('Supabase adapter remains lazy, validates keys and uses server-only authenticated object requests', async () => {
  let calls = 0; const seen = []
  const missing = createStorageAdapter({ storageDriver: 'supabase' }, async () => { calls++ })
  assert.equal(calls, 0); await assert.rejects(missing.read('sha256/test'), /SUPABASE_URL/)
  const adapter = createStorageAdapter({ storageDriver: 'supabase', storageUrl: 'https://storage.example.invalid', storageBucket: 'documents', storageKey: 'sb_secret_fixture-server-only-key' }, async (url, options) => {
    seen.push({ url, options }); return new Response(options.method === 'GET' ? 'fixture' : '{}', { status: 200 })
  })
  await adapter.save('sha256/test', Buffer.from('fixture'))
  assert.equal((await adapter.read('sha256/test')).toString(), 'fixture')
  await adapter.delete('sha256/test')
  assert.deepEqual(seen.map(call => call.options.method), ['POST', 'GET', 'DELETE'])
  assert.equal(seen[0].options.headers.authorization, undefined)
  assert.equal(seen[0].options.headers.apikey, 'sb_secret_fixture-server-only-key')
  assert.equal(seen[0].options.headers['x-upsert'], 'false')
  await assert.rejects(adapter.read('../escape'), /Invalid storage key/)
  const failing = createStorageAdapter({ storageDriver: 'supabase', storageUrl: 'https://storage.example.invalid', storageBucket: 'documents', storageKey: 'fixture-server-only-key' }, async () => new Response('credential-bearing provider body', { status: 500 }))
  await assert.rejects(failing.read('sha256/test'), error => error.status === 503 && !error.message.includes('credential-bearing'))
  const missingObject = createStorageAdapter({ storageDriver: 'supabase', storageUrl: 'https://storage.example.invalid', storageBucket: 'documents', storageKey: 'sb_secret_fixture-server-only-key' }, async () => new Response(JSON.stringify({ code: 'NoSuchKey', message: 'Object not found' }), { status: 400, headers: { 'content-type': 'application/json' } }))
  assert.equal(await missingObject.read('sha256/missing'), null)
  assert.equal(await missingObject.exists('sha256/missing'), false)
  const diagnosed = createStorageAdapter({ storageDriver: 'supabase', storageUrl: 'https://storage.example.invalid', storageBucket: 'documents', storageKey: 'sb_secret_fixture-server-only-key' }, async () => new Response(JSON.stringify({ code: 'AccessDenied', message: 'Permission denied' }), { status: 403, headers: { 'content-type': 'application/json' } }))
  await assert.rejects(diagnosed.read('sha256/test'), error => error.status === 503 && error.upstreamStatus === 403 && error.storageCode === 'AccessDenied' && error.upstreamMessage === 'Permission denied' && error.operation === 'read' && error.storageProvider === 'supabase' && error.bucketName === 'documents' && error.objectKeyShape === 'sha256/test')
  const absentBucket = createStorageAdapter({ storageDriver: 'supabase', storageUrl: 'https://storage.example.invalid', storageBucket: 'documents', storageKey: 'fixture-server-only-key' }, async () => new Response('Not found', { status: 404 }))
  await assert.rejects(absentBucket.save('sha256/test', Buffer.from('fixture')), error => error.status === 503)
})

test('transfer defaults to read-only dry-run and requires explicit demo policy before target access', async () => {
  const hash = () => crypto.createHash('sha256').update(readFileSync(process.env.DATABASE_PATH)).digest('hex')
  const before = hash()
  const report = inspectSqlite(process.env.DATABASE_PATH)
  assert.equal(report.mode, 'DRY RUN'); assert.equal(report.sourceUnmodified, true)
  assert.equal(report.ready, true, report.issues.join('; ')); assert.ok(report.demoAccounts.length)
  let connections = 0
  const pool = { async connect() { connections++; throw new Error('Must not connect') } }
  assert.equal((await transferSqlite(process.env.DATABASE_PATH, pool)).mode, 'DRY RUN')
  await assert.rejects(transferSqlite(process.env.DATABASE_PATH, pool, { apply: true }), /demo policy/)
  assert.equal(connections, 0); assert.equal(hash(), before)
  const cli = spawnSync(process.execPath, ['src/data/transferSqliteCli.js', `--source=${process.env.DATABASE_PATH}`], { cwd: path.resolve(import.meta.dirname, '..'), env: { ...process.env, DATABASE_URL: 'invalid-unused-in-dry-run' }, encoding: 'utf8', timeout: 10000 })
  assert.equal(cli.status, 0)
  assert.equal(JSON.parse(cli.stdout).mode, 'DRY RUN')
  assert.equal(hash(), before)
})

test('explicit transfer preserves every row/byte with a simulated target and rolls back verification failure', async () => {
  const { DatabaseSync } = await import('node:sqlite')
  const source = new DatabaseSync(process.env.DATABASE_PATH, { readOnly: true })
  const { transferTables } = await import('../src/data/sqliteTransfer.js')
  const sourceColumns = new Map(transferTables.map(name => [name, source.prepare(`PRAGMA table_info("${name}")`).all().map(column => column.name)]))
  const sourcePrograms = source.prepare('SELECT * FROM programs').all()
  source.close()
  function target(corrupt = false) {
    const data = new Map(transferTables.map(name => [name, name === 'programs' ? sourcePrograms.map(row => ({ ...row })) : []]))
    const commands = []; let released = false
    const pool = { async connect() { return {
      async query(sql, values = []) {
        commands.push(sql)
        if (sql.startsWith('SELECT COUNT(*)')) return { rows: [{ count: data.get(sql.match(/FROM "(\w+)"/)[1]).length }] }
        if (sql === 'SELECT * FROM programs') return { rows: data.get('programs') }
        if (sql.includes('information_schema.columns')) return { rows: sourceColumns.get(values[1]).map(column_name => ({ column_name })) }
        if (sql.startsWith('INSERT INTO "')) {
          const name = sql.match(/INSERT INTO "(\w+)"/)[1]
          const row = Object.fromEntries(sourceColumns.get(name).map((column, index) => [column, values[index]]))
          const existing = name === 'programs' ? data.get(name).findIndex(item => item.id === row.id) : -1
          if (existing >= 0) data.get(name)[existing] = row
          else data.get(name).push(row)
        }
        if (sql.startsWith('SELECT ')) {
          const name = sql.match(/FROM "(\w+)"/)?.[1]
          if (name) return { rows: data.get(name).map(row => corrupt && name === 'users' ? { ...row, password: 'corrupted' } : row) }
        }
        return { rows: [] }
      }, release() { released = true }
    } } }
    return { pool, commands, data, get released() { return released } }
  }
  const before = crypto.createHash('sha256').update(readFileSync(process.env.DATABASE_PATH)).digest('hex')
  const passing = target()
  const result = await transferSqlite(process.env.DATABASE_PATH, passing.pool, { apply: true, demoPolicy: 'include' })
  assert.equal(result.mode, 'APPLY'); assert.deepEqual(result.targetCounts, result.tables)
  assert.ok(passing.commands.includes('COMMIT')); assert.equal(passing.released, true)
  const failing = target(true)
  await assert.rejects(transferSqlite(process.env.DATABASE_PATH, failing.pool, { apply: true, demoPolicy: 'include' }), /data verification failed/)
  assert.ok(failing.commands.includes('ROLLBACK')); assert.equal(failing.released, true)
  assert.equal(crypto.createHash('sha256').update(readFileSync(process.env.DATABASE_PATH)).digest('hex'), before)
})

test('health and CORS return safe statuses and explicit credentials, without leaking dependency errors', async () => {
  const healthy = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://localhost:5173' } })
  assert.equal(healthy.status, 200)
  assert.equal(healthy.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  assert.equal(healthy.headers.get('access-control-allow-credentials'), 'true')
  assert.ok(healthy.headers.get('x-request-id'))
  assert.equal((await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://evil.example' } })).status, 403)
  const original = db.prepare
  db.prepare = () => { const error = new Error('private SQL exception'); error.code = 'ECONNREFUSED'; throw error }
  try {
    const response = await fetch(`${baseUrl}/api/health`)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { status: 'unavailable', database: 'unavailable', diagnosticCode: 'DATABASE_CONNECTION_FAILED' })
  } finally { db.prepare = original }
})

test('SIGTERM drains a real HTTP server and closes the database resource once', async () => {
  const http = app.listen(0, '127.0.0.1'); await once(http, 'listening')
  const signals = new EventEmitter(); let closes = 0
  let finish; const exited = new Promise(resolve => { finish = resolve })
  attachGracefulShutdown(http, async () => { closes++ }, { signals, exit: finish })
  signals.emit('SIGTERM'); signals.emit('SIGINT')
  assert.equal(await exited, 0); assert.equal(closes, 1); assert.equal(http.listening, false)
})
