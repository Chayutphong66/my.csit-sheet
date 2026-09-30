import assert from 'node:assert/strict'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

const backendRoot = path.resolve(import.meta.dirname, '..')
const bootstrapScript = path.join(backendRoot, 'src/data/bootstrapProduction.js')

function runBootstrap(databasePath) {
  return spawnSync(process.execPath, [bootstrapScript], {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_PATH: databasePath,
      JWT_SECRET: 'deployment-test-only-not-a-production-secret'
    },
    encoding: 'utf8'
  })
}

test('production bootstrap requires an absolute persistent database path', () => {
  const result = runBootstrap('relative.sqlite')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /absolute persistent path/)
})

test('production bootstrap preserves data, skips demo users, and is idempotent', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'csit-production-'))
  const databasePath = path.join(directory, 'production.sqlite')

  const firstRun = runBootstrap(databasePath)
  assert.equal(firstRun.status, 0, firstRun.stderr || firstRun.stdout)

  let database = new DatabaseSync(databasePath)
  assert.equal(database.prepare('SELECT COUNT(*) count FROM users').get().count, 0)
  assert.equal(database.prepare('SELECT COUNT(*) count FROM programs').get().count, 2)
  assert.ok(database.prepare('SELECT COUNT(*) count FROM course_offerings').get().count > 0)
  assert.equal(database.prepare("SELECT COUNT(*) count FROM course_imports WHERE status='COMPLETED'").get().count, 2)
  database.prepare(`INSERT INTO users(id,username,display_name,email,password,role)
    VALUES(?,?,?,?,?,?)`).run('persistence-marker', 'persist', 'Persist', 'persist@example.test', 'not-a-real-hash', 'USER')
  database.close()

  const secondRun = runBootstrap(databasePath)
  assert.equal(secondRun.status, 0, secondRun.stderr || secondRun.stdout)
  assert.ok(existsSync(`${databasePath}.predeploy-backup`))

  database = new DatabaseSync(databasePath)
  assert.equal(database.prepare("SELECT COUNT(*) count FROM users WHERE id='persistence-marker'").get().count, 1)
  assert.equal(database.prepare("SELECT COUNT(*) count FROM course_imports WHERE status='COMPLETED'").get().count, 2)
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), [])
  assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
  database.close()
})
