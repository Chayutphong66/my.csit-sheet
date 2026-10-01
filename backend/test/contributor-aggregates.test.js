import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.NODE_ENV = 'test'
process.env.SKIP_DB_SEED = '1'
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'csit-aggregate-')), 'test.sqlite')
const { db } = await import('../src/data/database.js')
const { findContributorByUsername, searchContributors } = await import('../src/repositories/contributor.repository.js')
test.after(() => db.close())

test('public contributor aggregates reconcile multiple documents, downloads and Helpful without row multiplication', async () => {
  const user = db.prepare("INSERT INTO users (id, username, email, password, role) VALUES (?, ?, ?, '', 'USER')")
  for (const name of ['owner', 'reader1', 'reader2', 'reader3']) user.run(name, name, `${name}@example.test`)
  for (const id of ['sheet1', 'sheet2']) {
    db.prepare("INSERT INTO sheets (id, title, subject, status, uploader_id, view_count, download_count, created_at) VALUES (?, ?, 'CS', 'APPROVED', 'owner', 10, 5, CURRENT_TIMESTAMP)").run(id, id)
    db.prepare("INSERT INTO upload_requests (id, user_id, sheet_id, title, file_name, document_type, status) VALUES (?, 'owner', ?, ?, 'test.txt', 'Sheet', 'COMPLETED')").run(`request-${id}`, id, id)
    for (const reader of ['reader1', 'reader2']) {
      db.prepare("INSERT INTO document_interactions (document_type, document_id, user_id, interaction_type) VALUES ('Sheet', ?, ?, 'DOWNLOAD')").run(id, reader)
    }
    for (const reader of ['reader1', 'reader2', 'reader3']) {
      db.prepare("INSERT INTO document_helpful_votes (document_type, document_id, user_id) VALUES ('Sheet', ?, ?)").run(id, reader)
    }
  }
  const profile = await findContributorByUsername('owner')
  assert.equal(profile.publishedCount, 2)
  assert.equal(profile.totalViews, 20)
  assert.equal(profile.totalDownloads, 10)
  assert.equal(profile.helpful, 6)
  assert.equal(profile.contributionScore, 2 * 20 + 4 * 2 + 6 * 5)
  assert.deepEqual((await searchContributors('OWN'))[0], profile)
  // Legacy self-interactions must never become qualified public rewards.
  db.prepare("INSERT INTO document_interactions (document_type, document_id, user_id, interaction_type) VALUES ('Sheet', 'sheet1', 'owner', 'DOWNLOAD')").run()
  db.prepare("INSERT INTO document_helpful_votes (document_type, document_id, user_id) VALUES ('Sheet', 'sheet1', 'owner')").run()
  assert.equal((await findContributorByUsername('owner')).contributionScore, profile.contributionScore)
})
