import { db } from '../data/databaseClient.js'
import { listProfileDocuments, listStarredPublicDocuments, findPublicDocument } from './document.repository.js'

export async function withStars(documents, viewerId) {
  const counts = await db.prepare('SELECT document_type, document_id, COUNT(*) AS count FROM document_stars GROUP BY document_type, document_id').all()
  const own = new Set((await db.prepare('SELECT document_type, document_id FROM document_stars WHERE user_id = ?').all(viewerId)).map(row => `${row.document_type}:${row.document_id}`))
  const totals = new Map(counts.map(row => [`${row.document_type}:${row.document_id}`, row.count]))
  return documents.map(document => ({ ...document, visibility: 'Public', starCount: totals.get(`${document.documentType}:${document.id}`) || 0, starredByMe: own.has(`${document.documentType}:${document.id}`) }))
}

export async function profileDocuments(userId, viewerId) { return await withStars(await listProfileDocuments(userId, viewerId), viewerId) }

export async function starredDocuments(userId, viewerId) {
  return await withStars(await listStarredPublicDocuments(userId, viewerId), viewerId)
}

export async function setStar(userId, type, id, starred) {
  const document = await findPublicDocument(type, id, userId)
  if (!document) return null
  if (starred) await db.prepare('INSERT OR IGNORE INTO document_stars(user_id, document_type, document_id) VALUES (?, ?, ?)').run(userId, document.documentType, id)
  else await db.prepare('DELETE FROM document_stars WHERE user_id = ? AND document_type = ? AND document_id = ?').run(userId, document.documentType, id)
  return (await withStars([document], userId))[0]
}

export async function profileActivity(userId, viewerId, documents) {
  const events = documents.map(document => ({ kind: 'Published', title: document.title, date: document.createdAt, documentType: document.documentType, documentId: document.id }))
  events.push(...(await db.prepare(`SELECT versions.document_type,versions.document_id,versions.version_number,versions.created_at,
    COALESCE(lectures.title,sheets.title,'Document revision') title FROM document_versions versions
    LEFT JOIN lectures ON versions.document_type='Lecture' AND lectures.id=versions.document_id
    LEFT JOIN sheets ON versions.document_type='Sheet' AND sheets.id=versions.document_id
    WHERE versions.submitted_by=? AND versions.status='APPROVED' AND versions.revision_type NOT IN ('INITIAL','RESTORE')`)
    .all(userId)).map(row => ({ kind: `Revision v${row.version_number}`, title: row.title, date: row.created_at, documentType: row.document_type, documentId: row.document_id })))
  if (userId === viewerId) {
    events.push(...(await db.prepare('SELECT id, title, created_at FROM upload_requests WHERE user_id = ?').all(userId)).map(row => ({ kind: 'Uploaded', title: row.title, date: row.created_at, requestId: row.id })))
  }
  for (const document of documents) {
    if (document.updatedAt && document.updatedAt !== document.createdAt) events.push({ kind: 'Updated', title: document.title, date: document.updatedAt, documentType: document.documentType, documentId: document.id })
  }
  return events.sort((a, b) => b.date.localeCompare(a.date))
}
