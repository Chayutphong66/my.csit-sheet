import crypto from 'node:crypto'
import { db, withTransaction } from '../data/databaseClient.js'
import { createNotification } from './notification.repository.js'
import { sendEmail } from '../services/email.service.js'
import { config } from '../config/environment.js'

const mapPerson = row => ({ username: row.username, displayName: row.display_name || row.username, avatarUrl: row.avatar_url || '', program: row.show_program ? row.program_code || '' : '', cohort: row.show_cohort ? row.cohort || '' : '' })

export async function followSummary(userId, viewerId) {
  const counts = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM user_follows WHERE followed_id=?) followers,
    (SELECT COUNT(*) FROM user_follows WHERE follower_id=?) following,
    EXISTS(SELECT 1 FROM user_follows WHERE follower_id=? AND followed_id=?) followed_by_me`).get(userId, userId, viewerId || '', userId)
  return { followersCount: Number(counts.followers), followingCount: Number(counts.following), followedByMe: Boolean(counts.followed_by_me) }
}

export async function setFollowing(follower, followed, following) {
  if (follower === followed) { const error = new Error('You cannot follow yourself'); error.status = 400; throw error }
  const target = await db.prepare("SELECT id,username,display_name FROM users WHERE id=? AND role='USER' AND profile_public=1").get(followed)
  if (!target) return null
  const result = following
    ? await db.prepare('INSERT OR IGNORE INTO user_follows(follower_id,followed_id) VALUES(?,?)').run(follower, followed)
    : await db.prepare('DELETE FROM user_follows WHERE follower_id=? AND followed_id=?').run(follower, followed)
  if (following && result.changes) {
    const preference = await db.prepare('SELECT new_follower FROM notification_preferences WHERE user_id=?').get(followed)
    if (preference?.new_follower !== 0) {
      const actor = await db.prepare('SELECT username,display_name FROM users WHERE id=?').get(follower)
      await createNotification({ userId: followed, title: 'New follower', message: `@${actor.username} started following you.`, type: 'NEW_FOLLOWER' })
    }
  }
  return followSummary(followed, follower)
}

export async function listConnections(userId, kind, viewerId) {
  const join = kind === 'followers' ? 'f.follower_id=u.id' : 'f.followed_id=u.id'
  const where = kind === 'followers' ? 'f.followed_id=?' : 'f.follower_id=?'
  const people = (await db.prepare(`SELECT u.* FROM user_follows f JOIN users u ON ${join} WHERE ${where} AND u.profile_public=1 ORDER BY f.created_at DESC LIMIT 100`).all(userId)).map(mapPerson)
  return Promise.all(people.map(async person => {
    const row = await db.prepare('SELECT id FROM users WHERE username=?').get(person.username)
    return { ...person, ...(await followSummary(row.id, viewerId)) }
  }))
}

export async function followingFeed(userId, { limit = 20, offset = 0 } = {}) {
  const rows = await db.prepare(`SELECT d.id,d.title,d.document_type,d.created_at,d.academic_year,d.semester,d.course_id,
    u.username,u.display_name,u.avatar_url,c.code course_code,c.name course_name FROM (
    SELECT l.id,l.title,l.created_at,l.uploader_id,l.course_id,'Lecture' document_type,l.academic_year,l.semester FROM lectures l WHERE l.status='APPROVED'
    UNION ALL
    SELECT s.id,s.title,s.created_at,s.uploader_id,s.course_id,'Sheet' document_type,s.academic_year,s.semester FROM sheets s WHERE s.status='APPROVED'
  ) d JOIN user_follows f ON f.followed_id=d.uploader_id JOIN users u ON u.id=d.uploader_id
  LEFT JOIN courses c ON c.id=d.course_id WHERE f.follower_id=? ORDER BY d.created_at DESC LIMIT ? OFFSET ?`).all(userId, limit, offset)
  return rows.map(row => ({ id: row.id, title: row.title, documentType: row.document_type, createdAt: row.created_at, academicYear: row.academic_year, semester: row.semester, uploader: { username: row.username, displayName: row.display_name || row.username, avatarUrl: row.avatar_url || '' }, course: { id: row.course_id, code: row.course_code || '', name: row.course_name || '' } }))
}

export async function getPreferences(userId) {
  await db.prepare('INSERT OR IGNORE INTO notification_preferences(user_id) VALUES(?)').run(userId)
  const row = await db.prepare('SELECT * FROM notification_preferences WHERE user_id=?').get(userId)
  return { newFollower: Boolean(row.new_follower), followedDocuments: Boolean(row.followed_documents), documentActivity: Boolean(row.document_activity), activityEmail: Boolean(row.activity_email) }
}

export async function savePreferences(userId, value) {
  await db.prepare(`INSERT INTO notification_preferences(user_id,new_follower,followed_documents,document_activity,activity_email,updated_at)
    VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET new_follower=excluded.new_follower,followed_documents=excluded.followed_documents,document_activity=excluded.document_activity,activity_email=excluded.activity_email,updated_at=CURRENT_TIMESTAMP`)
    .run(userId, value.newFollower ? 1 : 0, value.followedDocuments ? 1 : 0, value.documentActivity ? 1 : 0, value.activityEmail ? 1 : 0)
  return getPreferences(userId)
}

export async function createProfileChangeRequest({ userId, category, currentValue, requestedValue, reason }) {
  try {
    const id = crypto.randomUUID()
    await db.prepare('INSERT INTO profile_change_requests(id,user_id,category,current_value,requested_value,reason) VALUES(?,?,?,?,?,?)').run(id, userId, category, currentValue, requestedValue, reason)
    return findProfileChangeRequest(id)
  } catch (error) {
    if (error.code === '23505' || /UNIQUE constraint failed/.test(error.message || '')) { const conflict = new Error(`A pending ${category.toLowerCase()} request already exists`); conflict.status = 409; throw conflict }
    throw error
  }
}

export async function findProfileChangeRequest(id) { return db.prepare(`SELECT r.*,u.username,u.display_name,reviewer.username reviewer_username FROM profile_change_requests r JOIN users u ON u.id=r.user_id LEFT JOIN users reviewer ON reviewer.id=r.reviewer_id WHERE r.id=?`).get(id) }
export async function listProfileChangeRequests({ userId = null, status = '' } = {}) {
  const clauses = [], values = []
  if (userId) { clauses.push('r.user_id=?'); values.push(userId) }
  if (status) { clauses.push('r.status=?'); values.push(status) }
  return db.prepare(`SELECT r.*,u.username,u.display_name,reviewer.username reviewer_username FROM profile_change_requests r JOIN users u ON u.id=r.user_id LEFT JOIN users reviewer ON reviewer.id=r.reviewer_id ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY r.created_at DESC`).all(...values)
}

export async function decideProfileChangeRequest({ id, reviewerId, status, reason }) {
  return withTransaction(async () => {
    const request = await findProfileChangeRequest(id)
    if (!request) return null
    if (request.status !== 'PENDING') { const error = new Error('Request has already been processed'); error.status = 409; throw error }
    const result = await db.prepare('UPDATE profile_change_requests SET status=?,reviewer_id=?,decision_reason=?,decided_at=CURRENT_TIMESTAMP WHERE id=? AND status=\'PENDING\'').run(status, reviewerId, reason, id)
    if (!result.changes) { const error = new Error('Request has already been processed'); error.status = 409; throw error }
    if (status === 'APPROVED') {
      const column = request.category === 'PROGRAM' ? 'program_code' : 'cohort'
      await db.prepare(`UPDATE users SET ${column}=? WHERE id=?`).run(request.requested_value, request.user_id)
    }
    await createNotification({ userId: request.user_id, title: `${request.category} change ${status.toLowerCase()}`, message: reason || `Your requested change to ${request.requested_value} was ${status.toLowerCase()}.`, type: 'PROFILE_CHANGE' })
    return findProfileChangeRequest(id)
  })
}

export async function notifyFollowersOfDocument({ uploaderId, document }) {
  if (!uploaderId || !document) return []
  const followers = await db.prepare(`SELECT f.follower_id,u.email,u.username,p.activity_email FROM user_follows f
    JOIN users u ON u.id=f.follower_id
    LEFT JOIN notification_preferences p ON p.user_id=f.follower_id
    WHERE f.followed_id=? AND COALESCE(p.followed_documents,1)=1`).all(uploaderId)
  const actor = await db.prepare('SELECT username FROM users WHERE id=?').get(uploaderId)
  return Promise.all(followers.map(async ({ follower_id: userId, email, activity_email: activityEmail }) => {
    const notification = await createNotification({ userId, title: 'New document from someone you follow', message: `${document.title} was published.`, type: 'FOLLOWED_DOCUMENT' })
    if (activityEmail) {
      const last = await db.prepare("SELECT created_at FROM email_deliveries WHERE user_id=? AND template='followedDocument' ORDER BY created_at DESC LIMIT 1").get(userId)
      if (!last || Date.now() - new Date(last.created_at).getTime() >= 6 * 60 * 60 * 1000) {
        await sendEmail({ userId, to: email, template: 'followedDocument', data: { title: document.title, username: actor.username, url: `${config.appBaseUrl}/dashboard/documents/${document.documentType.toLowerCase()}/${document.id}` } })
      }
    }
    return notification
  }))
}
