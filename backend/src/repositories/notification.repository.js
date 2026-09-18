import crypto from 'node:crypto'
import { db } from '../data/database.js'

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

export function createNotification({
  userId,
  title,
  message,
  type = 'UPLOAD_REQUEST',
  uploadRequestId = ''
}) {
  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, upload_request_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, title, message, type, uploadRequestId || null)
  return findNotificationById(id)
}

export function notifyAdmins({ title, message, type = 'TEACHER_SUGGESTION', uploadRequestId = '' }) {
  return db.prepare("SELECT id FROM users WHERE role='ADMIN'").all().map(({ id }) => createNotification({ userId: id, title, message, type, uploadRequestId }))
}

export function findNotificationById(id) {
  return toNotification(db.prepare('SELECT * FROM notifications WHERE id = ?').get(id))
}

export function findNotificationsByUserId(userId) {
  return db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId)
    .map(toNotification)
}

export function markNotificationRead({ id, userId }) {
  const result = db
    .prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(id, userId)
  return result.changes > 0
}

export function countUnreadNotifications(userId) {
  return db
    .prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(userId).count
}
