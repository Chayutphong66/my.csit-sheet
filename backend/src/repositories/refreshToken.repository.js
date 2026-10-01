import { db } from '../data/databaseClient.js'

function toSession(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at
  }
}

export async function createRefreshSession(session) {
  await db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(session.id, session.userId, session.tokenHash, session.expiresAt)

  return await findRefreshSessionByHash(session.tokenHash)
}

export async function findRefreshSessionByHash(tokenHash) {
  return toSession(await db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash))
}

export async function revokeRefreshSessionByHash(tokenHash) {
  await db.prepare(`
    UPDATE refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE token_hash = ? AND revoked_at IS NULL
  `).run(tokenHash)
}

export async function revokeExpiredRefreshSessions() {
  await db.prepare(`
    UPDATE refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE revoked_at IS NULL AND expires_at <= CURRENT_TIMESTAMP
  `).run()
}
