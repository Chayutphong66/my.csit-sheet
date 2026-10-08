import crypto from 'node:crypto'
import { db, withTransaction } from '../data/databaseClient.js'

export const hashAccountToken = token => crypto.createHash('sha256').update(token).digest('hex')

export async function issueAccountToken(userId, purpose, minutes) {
  const token = crypto.randomBytes(32).toString('base64url')
  const hash = hashAccountToken(token)
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString()
  await withTransaction(async () => {
    await db.prepare('UPDATE account_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE user_id=? AND purpose=? AND consumed_at IS NULL').run(userId, purpose)
    await db.prepare('INSERT INTO account_tokens(id,user_id,purpose,token_hash,expires_at) VALUES(?,?,?,?,?)').run(crypto.randomUUID(), userId, purpose, hash, expiresAt)
  })
  return { token, expiresAt }
}

export async function consumeAccountToken(token, purpose, callback) {
  const hash = hashAccountToken(String(token || ''))
  return withTransaction(async () => {
    const record = await db.prepare('SELECT * FROM account_tokens WHERE token_hash=? AND purpose=? AND consumed_at IS NULL').get(hash, purpose)
    if (!record || new Date(record.expires_at).getTime() <= Date.now()) return null
    const result = await db.prepare('UPDATE account_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE id=? AND consumed_at IS NULL').run(record.id)
    if (!result.changes) return null
    return callback(record.user_id)
  })
}
