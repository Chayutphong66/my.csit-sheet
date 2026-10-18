import * as repository from '../repositories/feedback.repository.js'
import { db } from '../data/databaseClient.js'

export const FEEDBACK_CATEGORIES = ['BUG', 'FEEDBACK', 'FEATURE_REQUEST', 'INCORRECT_CONTENT']
export const FEEDBACK_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED', 'DUPLICATE']
const TRANSITIONS = {
  OPEN: ['IN_REVIEW', 'DUPLICATE'],
  IN_REVIEW: ['RESOLVED', 'CLOSED', 'DUPLICATE'],
  RESOLVED: ['CLOSED'],
  CLOSED: [], DUPLICATE: []
}

function httpError(message, status = 400) { const error = new Error(message); error.status = status; return error }
function text(value, name, min, max) {
  const normalized = String(value ?? '').trim()
  if (normalized.length < min || normalized.length > max) throw httpError(`${name} must be between ${min} and ${max} characters`)
  return normalized
}
function optionalText(value, name, max) {
  const normalized = String(value ?? '').trim()
  if (normalized.length > max) throw httpError(`${name} must not exceed ${max} characters`)
  return normalized
}
function pageOptions(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 20))
  return { page, limit }
}
function safeRelatedPath(value) {
  const path = optionalText(value, 'Related path', 300)
  if (!path) return ''
  const hasControlCharacter = [...path].some(character => character.codePointAt(0) < 32)
  if (!path.startsWith('/') || path.startsWith('//') || /[\\?#]/.test(path) || hasControlCharacter) throw httpError('Related path must be an application-relative path')
  return path
}
async function documentReference(typeValue, idValue) {
  const type = String(typeValue ?? '').trim()
  const documentId = String(idValue ?? '').trim()
  if (!type && !documentId) return { relatedDocumentType: '', relatedDocumentId: '' }
  if (!['Lecture', 'Sheet'].includes(type) || !/^[A-Za-z0-9_-]{1,100}$/.test(documentId)) throw httpError('Related document reference is invalid')
  const table = type === 'Lecture' ? 'lectures' : 'sheets'
  const exists = await db.prepare(`SELECT id FROM ${table} WHERE id=? AND status='APPROVED'`).get(documentId)
  if (!exists) throw httpError('Related document is not available', 404)
  return { relatedDocumentType: type, relatedDocumentId: documentId }
}
function mapReport(row) {
  return {
    reference: row.public_reference, category: row.category, subject: row.subject,
    description: row.description, relatedPath: row.related_path,
    relatedDocumentType: row.related_document_type, relatedDocumentId: row.related_document_id,
    status: row.status, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
    resolvedAt: row.resolved_at || null
  }
}
function publicEvents(events) {
  return events.filter(event => event.event_type !== 'NOTE_ADDED').map(event => ({
    type: event.event_type, previousStatus: event.previous_status, newStatus: event.new_status,
    publicMessage: event.public_message, createdAt: event.created_at
  }))
}

export async function submitFeedback(userId, body) {
  const category = String(body.category ?? '')
  if (!FEEDBACK_CATEGORIES.includes(category)) throw httpError('Feedback category is invalid')
  const clientRequestId = String(body.clientRequestId ?? '')
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(clientRequestId)) throw httpError('Client request id is invalid')
  const related = await documentReference(body.relatedDocumentType, body.relatedDocumentId)
  const result = await repository.createReport(userId, {
    clientRequestId, category, subject: text(body.subject, 'Subject', 5, 150),
    description: text(body.description, 'Description', 10, 4000), relatedPath: safeRelatedPath(body.relatedPath), ...related
  })
  return { report: mapReport(result.report), created: result.created }
}

export async function listOwnFeedback(userId, query) {
  const result = await repository.listReporterReports(userId, pageOptions(query))
  return { ...result, items: result.items.map(mapReport) }
}

export async function getOwnFeedback(userId, reference) {
  const row = await repository.findReporterReport(reference, userId)
  if (!row) throw httpError('Feedback report not found', 404)
  return { ...mapReport(row), events: publicEvents(await repository.listEvents(row.id)) }
}

export async function listAdminFeedback(query) {
  const status = String(query.status ?? '')
  const category = String(query.category ?? '')
  const sort = String(query.sort ?? 'newest')
  if (status && !FEEDBACK_STATUSES.includes(status)) throw httpError('Feedback status is invalid')
  if (category && !FEEDBACK_CATEGORIES.includes(category)) throw httpError('Feedback category is invalid')
  if (!['newest', 'oldest', 'updated'].includes(sort)) throw httpError('Feedback sort is invalid')
  const result = await repository.listAdminReports({ search: optionalText(query.search, 'Search', 100), status, category, sort, ...pageOptions(query) })
  return { ...result, items: result.items.map(mapReport) }
}

export async function getAdminFeedback(reference) {
  const row = await repository.findReport(reference)
  if (!row) throw httpError('Feedback report not found', 404)
  const events = (await repository.listEvents(row.id)).map(event => ({
    type: event.event_type, previousStatus: event.previous_status, newStatus: event.new_status,
    internalNote: event.internal_note, publicMessage: event.public_message,
    actorUsername: event.actor_username || null, createdAt: event.created_at
  }))
  return { ...mapReport(row), reporter: row.reporter_user_id ? { username: row.reporter_username, displayName: row.reporter_display_name } : null, events }
}

export async function updateAdminFeedback(reference, actorId, body) {
  const expectedVersion = Number(body.expectedVersion)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw httpError('Expected version is required')
  const status = body.status == null || body.status === '' ? '' : String(body.status)
  if (status && !FEEDBACK_STATUSES.includes(status)) throw httpError('Feedback status is invalid')
  const internalNote = optionalText(body.internalNote, 'Internal note', 2000)
  const publicMessage = optionalText(body.publicMessage, 'Public message', 1000)
  if (!status && !internalNote && !publicMessage) throw httpError('At least one review change is required')
  const report = await repository.updateReport(reference, actorId, { expectedVersion, status, internalNote, publicMessage }, (from, to) => TRANSITIONS[from]?.includes(to))
  if (!report) throw httpError('Feedback report not found', 404)
  return getAdminFeedback(reference)
}
