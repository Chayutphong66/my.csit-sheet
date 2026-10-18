import crypto from 'node:crypto'
import { db, lockFeedbackReport, withTransaction } from '../data/databaseClient.js'

function id() { return crypto.randomUUID() }
function publicReference() { return `FB-${crypto.randomBytes(8).toString('hex').toUpperCase()}` }

export async function findByClientRequest(reporterId, clientRequestId) {
  return db.prepare('SELECT * FROM feedback_reports WHERE reporter_user_id=? AND client_request_id=?').get(reporterId, clientRequestId)
}

export async function createReport(reporterId, input) {
  return withTransaction(async () => {
    const existing = await findByClientRequest(reporterId, input.clientRequestId)
    if (existing) return { report: existing, created: false }
    const reportId = id()
    const reference = publicReference()
    const insertion = await db.prepare(`INSERT INTO feedback_reports
        (id,public_reference,reporter_user_id,client_request_id,category,subject,description,related_path,related_document_type,related_document_id)
        VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(reporter_user_id,client_request_id) DO NOTHING`).run(
        reportId, reference, reporterId, input.clientRequestId, input.category, input.subject,
        input.description, input.relatedPath, input.relatedDocumentType, input.relatedDocumentId
    )
    if (insertion.changes === 0) return { report: await findByClientRequest(reporterId, input.clientRequestId), created: false }
    await db.prepare(`INSERT INTO feedback_report_events
      (id,report_id,actor_user_id,event_type,previous_status,new_status) VALUES (?,?,?,'CREATED','', 'OPEN')`)
      .run(id(), reportId, reporterId)
    return { report: await db.prepare('SELECT * FROM feedback_reports WHERE id=?').get(reportId), created: true }
  })
}

export async function listReporterReports(reporterId, { page, limit }) {
  const total = Number((await db.prepare('SELECT COUNT(*) count FROM feedback_reports WHERE reporter_user_id=?').get(reporterId)).count)
  const items = await db.prepare('SELECT * FROM feedback_reports WHERE reporter_user_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?')
    .all(reporterId, limit, (page - 1) * limit)
  return { items, page, limit, total }
}

export function findReporterReport(reference, reporterId) {
  return db.prepare('SELECT * FROM feedback_reports WHERE public_reference=? AND reporter_user_id=?').get(reference, reporterId)
}

export function findReport(reference) {
  return db.prepare('SELECT reports.*,users.username reporter_username,users.display_name reporter_display_name FROM feedback_reports reports LEFT JOIN users ON users.id=reports.reporter_user_id WHERE reports.public_reference=?').get(reference)
}

export function listEvents(reportId) {
  return db.prepare(`SELECT events.*,users.username actor_username FROM feedback_report_events events
    LEFT JOIN users ON users.id=events.actor_user_id WHERE events.report_id=? ORDER BY events.created_at,events.id`).all(reportId)
}

export async function listAdminReports({ search, status, category, sort, page, limit }) {
  const conditions = []
  const parameters = []
  if (search) { conditions.push('(LOWER(public_reference) LIKE ? OR LOWER(subject) LIKE ?)'); parameters.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`) }
  if (status) { conditions.push('status=?'); parameters.push(status) }
  if (category) { conditions.push('category=?'); parameters.push(category) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const order = sort === 'oldest' ? 'created_at ASC,id ASC' : sort === 'updated' ? 'updated_at DESC,id DESC' : 'created_at DESC,id DESC'
  const total = Number((await db.prepare(`SELECT COUNT(*) count FROM feedback_reports ${where}`).get(...parameters)).count)
  const items = await db.prepare(`SELECT * FROM feedback_reports ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...parameters, limit, (page - 1) * limit)
  return { items, page, limit, total }
}

export async function updateReport(reference, actorId, input, allowedTransition) {
  return withTransaction(async () => {
    const current = await db.prepare('SELECT * FROM feedback_reports WHERE public_reference=?').get(reference)
    if (!current) return null
    await lockFeedbackReport(current.id)
    const locked = await db.prepare('SELECT * FROM feedback_reports WHERE id=?').get(current.id)
    if (locked.version !== input.expectedVersion) {
      const error = new Error('Feedback report was updated by another reviewer')
      error.status = 409
      throw error
    }
    if (input.status && input.status !== locked.status && !allowedTransition(locked.status, input.status)) {
      const error = new Error(`Invalid feedback status transition: ${locked.status} to ${input.status}`)
      error.status = 409
      throw error
    }
    const nextStatus = input.status || locked.status
    const resolvedAt = nextStatus === 'RESOLVED' ? new Date().toISOString() : locked.resolved_at
    const result = await db.prepare(`UPDATE feedback_reports SET status=?,version=version+1,updated_at=CURRENT_TIMESTAMP,resolved_at=?
      WHERE id=? AND version=?`).run(nextStatus, resolvedAt, locked.id, locked.version)
    if (result.changes !== 1) {
      const error = new Error('Feedback report was updated by another reviewer')
      error.status = 409
      throw error
    }
    if (nextStatus !== locked.status) await db.prepare(`INSERT INTO feedback_report_events
      (id,report_id,actor_user_id,event_type,previous_status,new_status) VALUES (?,?,?,'STATUS_CHANGED',?,?)`)
      .run(id(), locked.id, actorId, locked.status, nextStatus)
    if (input.internalNote) await db.prepare(`INSERT INTO feedback_report_events
      (id,report_id,actor_user_id,event_type,internal_note) VALUES (?,?,?,'NOTE_ADDED',?)`)
      .run(id(), locked.id, actorId, input.internalNote)
    if (input.publicMessage) await db.prepare(`INSERT INTO feedback_report_events
      (id,report_id,actor_user_id,event_type,public_message) VALUES (?,?,?,'PUBLIC_MESSAGE',?)`)
      .run(id(), locked.id, actorId, input.publicMessage)
    return db.prepare('SELECT * FROM feedback_reports WHERE id=?').get(locked.id)
  })
}
