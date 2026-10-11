// Repeatable local-only benchmark for the connection-list query path.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

process.env.NODE_ENV = 'test'
process.env.DATABASE_DRIVER = 'sqlite'
process.env.STORAGE_DRIVER = 'database'
process.env.JWT_SECRET = 'local-performance-benchmark-secret'
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'csit-performance-')), 'benchmark.sqlite')

const { db, closeDatabase } = await import('../backend/src/data/databaseClient.js')
const { listConnections } = await import('../backend/src/repositories/community.repository.js')

const targetId = 'performance-target'
const viewerId = 'performance-viewer'
const insertUser = db.prepare(`INSERT INTO users
  (id,username,display_name,email,password,role,profile_public,show_program,show_cohort)
  VALUES(?,?,?,?,?,'USER',1,1,1)`)
await insertUser.run(targetId, targetId, 'Performance Target', 'performance-target@example.test', 'not-used')
await insertUser.run(viewerId, viewerId, 'Performance Viewer', 'performance-viewer@example.test', 'not-used')
for (let index = 0; index < 100; index += 1) {
  const id = `performance-follower-${index}`
  await insertUser.run(id, id, `Follower ${index}`, `${id}@example.test`, 'not-used')
  await db.prepare('INSERT INTO user_follows(follower_id,followed_id) VALUES(?,?)').run(id, targetId)
  if (index % 2 === 0) await db.prepare('INSERT INTO user_follows(follower_id,followed_id) VALUES(?,?)').run(viewerId, id)
}

const originalPrepare = db.prepare
let statementCount = 0
db.prepare = (...args) => {
  statementCount += 1
  return originalPrepare(...args)
}

await listConnections(targetId, 'followers', viewerId)
statementCount = 0
const iterations = 20
const startedAt = performance.now()
for (let index = 0; index < iterations; index += 1) {
  const people = await listConnections(targetId, 'followers', viewerId)
  if (people.length !== 100) throw new Error(`Expected 100 people, received ${people.length}`)
}
const elapsedMs = performance.now() - startedAt

console.log(JSON.stringify({
  scenario: '100-person followers list',
  iterations,
  statementsPerRequest: statementCount / iterations,
  averageMs: Number((elapsedMs / iterations).toFixed(3)),
  totalMs: Number(elapsedMs.toFixed(3))
}, null, 2))

db.prepare = originalPrepare
await closeDatabase()
