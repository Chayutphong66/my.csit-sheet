import { findContributorByUsername, searchContributors } from '../repositories/contributor.repository.js'
import { profileDocuments, starredDocuments, profileActivity, setStar } from '../repositories/profile.repository.js'
import { findUploadRequestsByUserId } from '../repositories/uploadRequest.repository.js'
import { db } from '../data/database.js'

function safeDocument(document) {
  const { uploaderId, ...safe } = document
  return safe
}

export function search(req, res) {
  const query = String(req.query.q ?? '').trim().slice(0, 100)
  const contributors = query ? searchContributors(query).map(({ id, ...safe }) => safe) : []
  res.json({ query, contributors })
}

export function profile(req, res) {
  const contributor = findContributorByUsername(req.params.username)
  if (!contributor) {
    res.status(404).json({ message: 'ไม่พบผู้แบ่งปันคนนี้' })
    return
  }
  const { id, ...safeContributor } = contributor
  const documents = profileDocuments(id, req.user.id).map(safeDocument)
  const isOwner = id === req.user.id
  res.json({
    ...safeContributor,
    isOwner,
    ...(isOwner ? { privateAccount: { email: req.user.email, role: req.user.role } } : {}),
    documents,
    stars: starredDocuments(id, req.user.id).map(safeDocument),
    requests: isOwner ? findUploadRequestsByUserId(id).map(({ id, title, fileName, documentType, courseName, createdAt, status, rejectionReason }) => ({ id, title, fileName, documentType, courseName, createdAt, status, rejectionReason })) : [],
    activity: profileActivity(id, req.user.id, documents)
  })
}

export function star(req, res) {
  if (typeof req.body.starred !== 'boolean') return res.status(400).json({ message: 'starred must be a boolean' })
  const document = setStar(req.user.id, req.params.type, req.params.id, req.body.starred)
  if (!document) return res.status(404).json({ message: 'Document not found' })
  res.json(safeDocument(document))
}

export function edit(req, res) {
  const name = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : ''
  if (!name || name.length > 100) return res.status(400).json({ message: 'Display name must contain 1-100 characters' })
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(name, req.user.id)
  res.json({ displayName: name })
}
