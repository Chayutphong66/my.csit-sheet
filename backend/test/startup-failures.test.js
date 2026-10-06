import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const cwd = path.resolve(import.meta.dirname, '..')
function run(extra, script = 'src/server.js') {
  return spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', timeout: 15000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_DRIVER: 'postgres',
      DATABASE_URL: 'postgresql://127.0.0.1:1/csit_test',
      ALLOWED_ORIGINS: 'https://mycsit-sheet.netlify.app',
      STORAGE_DRIVER: 'supabase',
      SUPABASE_URL: 'https://fixture.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_fixture-server-only-key',
      SUPABASE_STORAGE_BUCKET: 'documents',
      ...extra
    }
  })
}

test('production missing JWT still fails startup without opening a database', () => {
  const result = run({ JWT_SECRET: '' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /JWT_SECRET must be configured in production/)
  assert.doesNotMatch(result.stderr, /database.health_check_failed/)
})

test('unavailable local PostgreSQL fails safely and pool shutdown lets the process exit', () => {
  const result = run({ JWT_SECRET: 'non-production-fixture-signing-key' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /server.startup_failed/)
  assert.match(result.stderr, /ECONNREFUSED/)
  assert.doesNotMatch(result.stderr, /postgresql:\/\/127\.0\.0\.1:1/)
  assert.equal(result.error, undefined)
})

test('SQLite maintenance entry points reject production before any local file access', () => {
  for (const script of ['src/data/seed.js', 'src/data/storageReport.js']) {
    const result = run({}, script)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Direct SQLite access is local-only/)
  }
})
