import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.NODE_ENV = 'test'
process.env.DATABASE_DRIVER = 'sqlite'
process.env.STORAGE_DRIVER = 'database'
process.env.JWT_SECRET = 'verification-enforcement-test-secret'
process.env.EMAIL_VERIFICATION_ENFORCED = 'true'
process.env.SMTP_HOST = '127.0.0.1'
process.env.SMTP_USER = 'smtp-fixture@example.test'
process.env.SMTP_PASS = 'smtp-fixture-password'
process.env.APP_BASE_URL = 'http://127.0.0.1'
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'csit-verification-enforcement-')), 'fixture.sqlite')

const { closeDatabase, db } = await import('../src/data/databaseClient.js')
const { login } = await import('../src/services/auth.service.js')

test.after(async () => closeDatabase())

test('email verification enforcement rejects an unverified local account before session issuance', async () => {
  const user = await db.prepare("SELECT id FROM users WHERE username='student02'").get()
  await db.prepare('UPDATE users SET is_verified=0,email_verified_at=NULL WHERE id=?').run(user.id)

  await assert.rejects(
    login({ usernameOrEmail: 'student02', password: 'User@1234' }),
    error => error.status === 403 && /verify your email/i.test(error.message)
  )
})
