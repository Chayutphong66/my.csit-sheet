import { findContributorByUsername, searchContributors } from '../repositories/contributor.repository.js'
import { profileDocuments, starredDocuments, profileActivity, setStar } from '../repositories/profile.repository.js'
import { findUploadRequestsByUserId } from '../repositories/uploadRequest.repository.js'
import { db } from '../data/databaseClient.js'
import { listMyRevisions } from '../repositories/documentVersion.repository.js'
import { normalizeCohort, normalizeProgram } from '../services/communityIdentity.service.js'
import { findUserById } from '../repositories/user.repository.js'
import { createProfileChangeRequest, followSummary, followingFeed, getPreferences, listConnections, listProfileChangeRequests, savePreferences, setFollowing } from '../repositories/community.repository.js'
import { sendEmail } from '../services/email.service.js'
import { storage } from '../services/storageAdapter.js'
import crypto from 'node:crypto'

function safeDocument(document) {
  const { uploaderId, ...safe } = document
  return safe
}

export async function search(req, res) {
  const query = String(req.query.q ?? '').trim().slice(0, 100)
  const contributors = query ? (await searchContributors(query)).map(({ id, ...safe }) => safe) : []
  res.json({ query, contributors })
}

export async function profile(req, res) {
  const contributor = await findContributorByUsername(req.params.username)
  if (!contributor) {
    res.status(404).json({ message: 'ไม่พบผู้แบ่งปันคนนี้' })
    return
  }
  const { id, ...safeContributor } = contributor
  if (!contributor.profilePublic && id !== req.user.id) return res.status(404).json({ message: 'Profile not found' })
  const documents = (await profileDocuments(id, req.user.id)).map(safeDocument)
  const isOwner = id === req.user.id
  const [stars, requests, revisions, activity] = await Promise.all([
    starredDocuments(id, req.user.id),
    isOwner ? findUploadRequestsByUserId(id) : [],
    isOwner ? listMyRevisions(id) : [],
    profileActivity(id, req.user.id, documents)
  ])
  const follows = await followSummary(id, req.user.id)
  res.json({
    ...safeContributor,
    ...follows,
    isOwner,
    documents,
    stars: stars.map(safeDocument),
    requests: requests.map(({ id, title, fileName, documentType, courseName, createdAt, status, rejectionReason }) => ({ id, title, fileName, documentType, courseName, createdAt, status, rejectionReason })),
    revisions,
    activity
  })
}

export async function star(req, res) {
  if (typeof req.body.starred !== 'boolean') return res.status(400).json({ message: 'starred must be a boolean' })
  const document = await setStar(req.user.id, req.params.type, req.params.id, req.body.starred)
  if (!document) return res.status(404).json({ message: 'Document not found' })
  res.json(safeDocument(document))
}

export async function edit(req, res) {
  try {
    const name = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : ''
    if (!name || name.length > 100) return res.status(400).json({ message: 'Display name must contain 1-100 characters' })
    const current = await findUserById(req.user.id)
    if (name !== current.displayName && current.displayNameChangedAt && Date.now() < new Date(current.displayNameChangedAt).getTime() + 30 * 86400000) {
      const error = new Error('Display name can only be changed once every 30 days'); error.status = 409; throw error
    }
    const bio = typeof req.body.bio === 'string' ? req.body.bio.trim().slice(0, 300) : current.bio
    const changed = name !== current.displayName
    await db.prepare(`UPDATE users SET display_name=?,bio=?,display_name_changed_at=CASE WHEN display_name<>? THEN CURRENT_TIMESTAMP ELSE display_name_changed_at END WHERE id=?`).run(name, bio, name, req.user.id)
    if (changed) await sendEmail({ userId: current.id, to: current.email, template: 'displayNameChanged', data: { displayName: name, nextChangeAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) } })
    res.json({ displayName: name, bio, nextDisplayNameChangeAt: changed ? new Date(Date.now() + 30 * 86400000).toISOString() : null })
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message })
  }
}

export async function follow(req, res, next) {
  try {
    if (typeof req.body.following !== 'boolean') return res.status(400).json({ message: 'following must be a boolean' })
    const target = await db.prepare("SELECT id FROM users WHERE lower(username)=lower(?) AND role='USER'").get(req.params.username)
    if (!target) return res.status(404).json({ message: 'Profile not found' })
    res.json(await setFollowing(req.user.id, target.id, req.body.following))
  } catch (error) { next(error) }
}

async function connectionList(req, res, kind) {
  const target = await db.prepare("SELECT id,profile_public FROM users WHERE lower(username)=lower(?) AND role='USER'").get(req.params.username)
  if (!target || (!target.profile_public && target.id !== req.user.id)) return res.status(404).json({ message: 'Profile not found' })
  res.json(await listConnections(target.id, kind, req.user.id))
}
export const followers = (req, res) => connectionList(req, res, 'followers')
export const following = (req, res) => connectionList(req, res, 'following')
export async function feed(req, res) { const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50); const offset = Math.max(Number(req.query.offset) || 0, 0); res.json({ items: await followingFeed(req.user.id, { limit, offset }), limit, offset }) }

export async function settings(req, res) {
  const user = await findUserById(req.user.id)
  res.json({ account: { email: user.email, role: user.role, emailVerified: user.isVerified }, profile: { displayName: user.displayName, bio: user.bio, program: user.program, cohort: user.cohort, avatarUrl: user.avatarUrl, profilePublic: user.profilePublic, showProgram: user.showProgram, showCohort: user.showCohort, nextDisplayNameChangeAt: user.displayNameChangedAt ? new Date(new Date(user.displayNameChangedAt).getTime() + 30 * 86400000).toISOString() : null }, notifications: await getPreferences(user.id), changeRequests: await listProfileChangeRequests({ userId: user.id }) })
}

export async function saveSettings(req, res, next) {
  try {
    if (req.body.notifications) await savePreferences(req.user.id, req.body.notifications)
    if (req.body.privacy) await db.prepare('UPDATE users SET profile_public=?,show_program=?,show_cohort=? WHERE id=?').run(req.body.privacy.profilePublic ? 1 : 0, req.body.privacy.showProgram ? 1 : 0, req.body.privacy.showCohort ? 1 : 0, req.user.id)
    res.json({ message: 'Settings saved' })
  } catch (error) { next(error) }
}

export async function requestProfileChange(req, res, next) {
  try {
    const category = String(req.body.category || '').toUpperCase()
    if (!['PROGRAM', 'COHORT'].includes(category)) return res.status(400).json({ message: 'Invalid change category' })
    const requestedValue = category === 'PROGRAM' ? normalizeProgram(req.body.requestedValue) : normalizeCohort(req.body.requestedValue)
    const reason = String(req.body.reason || '').trim()
    if (reason.length < 5 || reason.length > 500) return res.status(400).json({ message: 'Reason must contain 5-500 characters' })
    const user = await findUserById(req.user.id); const currentValue = category === 'PROGRAM' ? user.program : user.cohort
    if (requestedValue === currentValue) return res.status(400).json({ message: 'Requested value must differ from the current value' })
    res.status(201).json(await createProfileChangeRequest({ userId: user.id, category, currentValue, requestedValue, reason }))
  } catch (error) { next(error) }
}
export async function myChangeRequests(req, res) { res.json(await listProfileChangeRequests({ userId: req.user.id })) }

function imageType(bytes) {
  const validDimensions = (width, height) => width > 0 && height > 0 && width <= 4096 && height <= 4096
  if (bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.subarray(12, 16).toString() === 'IHDR' && bytes.subarray(-8, -4).toString() === 'IEND' && validDimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20))) return 'image/png'
  if (bytes.length >= 20 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) {
    let offset = 2
    while (offset + 8 < bytes.length) {
      if (bytes[offset++] !== 0xff) break
      while (bytes[offset] === 0xff) offset++
      const marker = bytes[offset++]
      if ([0xd8, 0xd9].includes(marker)) continue
      const length = bytes.readUInt16BE(offset)
      if (length < 2 || offset + length > bytes.length) break
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && validDimensions(bytes.readUInt16BE(offset + 3), bytes.readUInt16BE(offset + 5))) return 'image/jpeg'
      offset += length
    }
  }
  if (bytes.length >= 30 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.subarray(12, 16).toString())) return 'image/webp'
  return ''
}
export async function uploadAvatar(req, res, next) {
  try {
    const encoded = String(req.body?.fileData || '').replace(/^data:[^;]+;base64,/, '')
    const bytes = Buffer.from(encoded, 'base64')
    if (!bytes.length || bytes.length > 1024 * 1024) return res.status(400).json({ message: 'Please upload a picture smaller than 1 MB.' })
    const mimeType = imageType(bytes); if (!mimeType) return res.status(400).json({ message: 'Please upload a valid PNG, JPEG, or WebP image.' })
    const hash = crypto.createHash('sha256').update(bytes).digest('hex'); const key = `sha256/${hash}`
    await storage.save(key, bytes, { originalFilename: 'avatar', mimeType })
    const user = await findUserById(req.user.id); const avatarUrl = `/api/contributors/${encodeURIComponent(user.username)}/avatar?v=${hash.slice(0, 12)}`
    await db.prepare('UPDATE users SET avatar_storage_key=?,avatar_url=? WHERE id=?').run(key, avatarUrl, user.id)
    res.json({ avatarUrl })
  } catch (error) { next(error) }
}
export async function removeAvatar(req, res) { await db.prepare("UPDATE users SET avatar_storage_key=NULL,avatar_url='' WHERE id=?").run(req.user.id); res.status(204).end() }
export async function avatar(req, res, next) {
  try {
    const user = await db.prepare('SELECT avatar_storage_key FROM users WHERE lower(username)=lower(?)').get(req.params.username)
    if (!user?.avatar_storage_key) return res.status(404).end()
    const bytes = await storage.read(user.avatar_storage_key); if (!bytes) return res.status(404).end()
    res.setHeader('Content-Type', imageType(Buffer.from(bytes)) || 'application/octet-stream'); res.setHeader('Cache-Control', 'public,max-age=31536000,immutable'); res.send(Buffer.from(bytes))
  } catch (error) { next(error) }
}
