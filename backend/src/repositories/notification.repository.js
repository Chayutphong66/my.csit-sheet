import crypto from 'node:crypto'
import { db } from '../data/databaseClient.js'

function toNotification(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type,
    uploadRequestId: row.upload_request_id,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at
  }
}

export async function createNotification({
  userId,
  title,
  message,
  type = 'UPLOAD_REQUEST',
  uploadRequestId = ''
}) {
  const id = crypto.randomUUID()
  await db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, upload_request_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, title, message, type, uploadRequestId || null)
  return await findNotificationById(id)
}

export async function notifyAdmins({ title, message, type = 'TEACHER_SUGGESTION', uploadRequestId = '' }) {
  const admins = await db.prepare("SELECT id FROM users WHERE role='ADMIN'").all()
  return await Promise.all(admins.map(({ id }) => createNotification({ userId: id, title, message, type, uploadRequestId })))
}

export async function findNotificationById(id) {
  return toNotification(await db.prepare('SELECT * FROM notifications WHERE id = ?').get(id))
}

export async function findNotificationsByUserId(userId) {
  return (await db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId)).map(toNotification)
}

export async function markNotificationRead({ id, userId }) {
  const result = await db
    .prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(id, userId)
  return result.changes > 0
}

export async function countUnreadNotifications(userId) {
  return (await db
    .prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(userId)).count
}
