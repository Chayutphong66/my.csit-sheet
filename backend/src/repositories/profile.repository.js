import { db } from '../data/database.js'
import { listProfileDocuments, listStarredPublicDocuments, findPublicDocument } from './document.repository.js'

export function withStars(documents, viewerId) {
  const counts = db.prepare('SELECT document_type, document_id, COUNT(*) AS count FROM document_stars GROUP BY document_type, document_id').all()
  const own = new Set(db.prepare('SELECT document_type, document_id FROM document_stars WHERE user_id = ?').all(viewerId).map(row => `${row.document_type}:${row.document_id}`))
  const totals = new Map(counts.map(row => [`${row.document_type}:${row.document_id}`, row.count]))
  return documents.map(document => ({ ...document, visibility: 'Public', starCount: totals.get(`${document.documentType}:${document.id}`) || 0, starredByMe: own.has(`${document.documentType}:${document.id}`) }))
}

export function profileDocuments(userId, viewerId) { return withStars(listProfileDocuments(userId, viewerId), viewerId) }

export function starredDocuments(userId, viewerId) {
  return withStars(listStarredPublicDocuments(userId, viewerId), viewerId)
}

export function setStar(userId, type, id, starred) {
  const document = findPublicDocument(type, id, userId)
  if (!document) return null
  if (starred) db.prepare('INSERT OR IGNORE INTO document_stars(user_id, document_type, document_id) VALUES (?, ?, ?)').run(userId, document.documentType, id)
  else db.prepare('DELETE FROM document_stars WHERE user_id = ? AND document_type = ? AND document_id = ?').run(userId, document.documentType, id)
  return withStars([document], userId)[0]
}

export function profileActivity(userId, viewerId, documents) {
  const events = documents.map(document => ({ kind: 'Published', title: document.title, date: document.createdAt, documentType: document.documentType, documentId: document.id }))
  if (userId === viewerId) {
    events.push(...db.prepare('SELECT id, title, created_at FROM upload_requests WHERE user_id = ?').all(userId).map(row => ({ kind: 'Uploaded', title: row.title, date: row.created_at, requestId: row.id })))
  }
  for (const document of documents) {
    if (document.updatedAt && document.updatedAt !== document.createdAt) events.push({ kind: 'Updated', title: document.title, date: document.updatedAt, documentType: document.documentType, documentId: document.id })
  }
  return events.sort((a, b) => b.date.localeCompare(a.date))
}
