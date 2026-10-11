import crypto from 'node:crypto'
import { db } from '../data/databaseClient.js'

function toAudit(row) {
  if (!row) return null
  let changes = {}
  try { changes = JSON.parse(row.changesJson || '{}') } catch { changes = {} }
  return {
    id: row.id, actorUserId: row.actorUserId, actorUsername: row.actorUsername,
    targetUserId: row.targetUserId, targetUsername: row.targetUsername,
    action: row.action, changes, createdAt: row.createdAt
  }
}

export async function createAdminAudit({ actorUserId, targetUserId, action, changes }) {
  const id = crypto.randomUUID()
  await db.prepare(`INSERT INTO admin_audit_logs (id, actor_user_id, target_user_id, action, changes_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, actorUserId, targetUserId, action, JSON.stringify(changes), new Date().toISOString())
  return id
}

export async function listAdminAudits({ targetUserId = '', page = 1, limit = 20 } = {}) {
  const where = targetUserId ? ' WHERE a.target_user_id=?' : ''
  const params = targetUserId ? [targetUserId] : []
  const total = Number((await db.prepare(`SELECT COUNT(*) AS count FROM admin_audit_logs a${where}`).get(...params)).count)
  const rows = await db.prepare(`SELECT a.id, a.actor_user_id AS actorUserId, actor.username AS actorUsername,
    a.target_user_id AS targetUserId, target.username AS targetUsername, a.action,
    a.changes_json AS changesJson, a.created_at AS createdAt
    FROM admin_audit_logs a JOIN users actor ON actor.id=a.actor_user_id
    JOIN users target ON target.id=a.target_user_id${where}
    ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit)
  return { items: rows.map(toAudit), total }
}
