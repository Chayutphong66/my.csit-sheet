import { db } from '../data/database.js'

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

export function createRefreshSession(session) {
  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(session.id, session.userId, session.tokenHash, session.expiresAt)

  return findRefreshSessionByHash(session.tokenHash)
}

export function findRefreshSessionByHash(tokenHash) {
  return toSession(db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash))
}

export function revokeRefreshSessionByHash(tokenHash) {
  db.prepare(`
    UPDATE refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE token_hash = ? AND revoked_at IS NULL
  `).run(tokenHash)
}

export function revokeExpiredRefreshSessions() {
  db.prepare(`
    UPDATE refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE revoked_at IS NULL AND expires_at <= CURRENT_TIMESTAMP
  `).run()
}
