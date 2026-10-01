import { findContributorByUsername, searchContributors } from '../repositories/contributor.repository.js'
import { profileDocuments, starredDocuments, profileActivity, setStar } from '../repositories/profile.repository.js'
import { findUploadRequestsByUserId } from '../repositories/uploadRequest.repository.js'
import { db } from '../data/databaseClient.js'
import { listMyRevisions } from '../repositories/documentVersion.repository.js'
import { normalizeCohort, normalizeProgram } from '../services/communityIdentity.service.js'

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
  const documents = (await profileDocuments(id, req.user.id)).map(safeDocument)
  const isOwner = id === req.user.id
  const [stars, requests, revisions, activity] = await Promise.all([
    starredDocuments(id, req.user.id),
    isOwner ? findUploadRequestsByUserId(id) : [],
    isOwner ? listMyRevisions(id) : [],
    profileActivity(id, req.user.id, documents)
  ])
  res.json({
    ...safeContributor,
    isOwner,
    ...(isOwner ? { privateAccount: { email: req.user.email, role: req.user.role } } : {}),
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
    const program = normalizeProgram(req.body.program, { required: false })
    const cohort = normalizeCohort(req.body.cohort, { required: false })
    await db.prepare('UPDATE users SET display_name = ?,program_code=?,cohort=? WHERE id = ?').run(name, program, cohort, req.user.id)
    res.json({ displayName: name, program, cohort })
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message })
  }
}
