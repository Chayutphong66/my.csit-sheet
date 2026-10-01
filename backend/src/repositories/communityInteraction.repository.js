import { db, withTransaction } from '../data/databaseClient.js'

function materialTable(documentType) {
  if (documentType === 'Lecture') return 'lectures'
  if (documentType === 'Sheet') return 'sheets'
  throw new Error('Unsupported document type')
}

export async function recordDocumentInteraction({ userId, document, interactionType }) {
  if (!userId || userId === document.uploaderId) return { recorded: false }
  if (!['VIEW', 'DOWNLOAD'].includes(interactionType)) throw new Error('Unsupported interaction type')

  return withTransaction(async () => {
    const result = await db.prepare(`
      INSERT OR IGNORE INTO document_interactions (
        user_id, document_type, document_id, interaction_type, created_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(userId, document.documentType, document.id, interactionType)
    if (result.changes > 0) {
      const column = interactionType === 'VIEW' ? 'view_count' : 'download_count'
      await db.prepare(`UPDATE ${materialTable(document.documentType)} SET ${column} = ${column} + 1 WHERE id = ?`)
        .run(document.id)
    }
    return { recorded: result.changes > 0 }
  })
}

export async function findHelpfulState({ userId, documentType, documentId }) {
  const count = Number((await db.prepare(`
    SELECT COUNT(*) AS count FROM document_helpful_votes
    WHERE document_type = ? AND document_id = ?
  `).get(documentType, documentId)).count)
  const helpful = Boolean(userId && await db.prepare(`
    SELECT 1 FROM document_helpful_votes
    WHERE user_id = ? AND document_type = ? AND document_id = ?
  `).get(userId, documentType, documentId))
  return { helpful, helpfulCount: count }
}

export async function setDocumentHelpful({ userId, document, helpful }) {
  if (userId === document.uploaderId) {
    const error = new Error('You cannot mark your own contribution as Helpful')
    error.status = 403
    error.expose = true
    throw error
  }
  if (helpful) {
    await db.prepare(`
      INSERT OR IGNORE INTO document_helpful_votes (user_id, document_type, document_id, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(userId, document.documentType, document.id)
  } else {
    await db.prepare(`
      DELETE FROM document_helpful_votes WHERE user_id = ? AND document_type = ? AND document_id = ?
    `).run(userId, document.documentType, document.id)
  }
  return await findHelpfulState({ userId, documentType: document.documentType, documentId: document.id })
}
