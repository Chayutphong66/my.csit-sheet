import { db } from '../data/database.js'

function materialTable(documentType) {
  if (documentType === 'Lecture') return 'lectures'
  if (documentType === 'Sheet') return 'sheets'
  throw new Error('Unsupported document type')
}

export function recordDocumentInteraction({ userId, document, interactionType }) {
  if (!userId || userId === document.uploaderId) return { recorded: false }
  if (!['VIEW', 'DOWNLOAD'].includes(interactionType)) throw new Error('Unsupported interaction type')

  db.exec('BEGIN')
  try {
    const result = db.prepare(`
      INSERT OR IGNORE INTO document_interactions (
        user_id, document_type, document_id, interaction_type, created_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(userId, document.documentType, document.id, interactionType)
    if (result.changes > 0) {
      const column = interactionType === 'VIEW' ? 'view_count' : 'download_count'
      db.prepare(`UPDATE ${materialTable(document.documentType)} SET ${column} = ${column} + 1 WHERE id = ?`)
        .run(document.id)
    }
    db.exec('COMMIT')
    return { recorded: result.changes > 0 }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function findHelpfulState({ userId, documentType, documentId }) {
  const count = Number(db.prepare(`
    SELECT COUNT(*) AS count FROM document_helpful_votes
    WHERE document_type = ? AND document_id = ?
  `).get(documentType, documentId).count)
  const helpful = Boolean(userId && db.prepare(`
    SELECT 1 FROM document_helpful_votes
    WHERE user_id = ? AND document_type = ? AND document_id = ?
  `).get(userId, documentType, documentId))
  return { helpful, helpfulCount: count }
}

export function setDocumentHelpful({ userId, document, helpful }) {
  if (userId === document.uploaderId) {
    const error = new Error('You cannot mark your own contribution as Helpful')
    error.status = 403
    error.expose = true
    throw error
  }
  if (helpful) {
    db.prepare(`
      INSERT OR IGNORE INTO document_helpful_votes (user_id, document_type, document_id, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(userId, document.documentType, document.id)
  } else {
    db.prepare(`
      DELETE FROM document_helpful_votes WHERE user_id = ? AND document_type = ? AND document_id = ?
    `).run(userId, document.documentType, document.id)
  }
  return findHelpfulState({ userId, documentType: document.documentType, documentId: document.id })
}
