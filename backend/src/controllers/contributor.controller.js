import { findContributorByUsername, searchContributors } from '../repositories/contributor.repository.js'
import { listPublicDocumentsByUploaderId } from '../repositories/document.repository.js'

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
  res.json({
    ...safeContributor,
    documents: listPublicDocumentsByUploaderId(id, req.user.id).map(safeDocument)
  })
}
