import crypto from 'node:crypto'
import { db } from '../data/database.js'
import { getOrCreateFileAsset } from './fileAsset.repository.js'

export const REVISION_TYPES = Object.freeze([
  'ADD_CONTENT', 'CORRECT_CONTENT', 'REMOVE_INCORRECT',
  'UPDATE_DOCUMENT', 'NEW_ACADEMIC_YEAR', 'OTHER'
])

function validationError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  error.expose = true
  return error
}

export function normalizeVersionDocumentType(value) {
  const type = String(value || '').toLowerCase()
  if (type === 'lecture') return 'Lecture'
  if (type === 'sheet') return 'Sheet'
  return null
}

function canonicalTable(type) { return type === 'Lecture' ? 'lectures' : 'sheets' }

export function findCanonicalDocument(typeValue, id) {
  const type = normalizeVersionDocumentType(typeValue)
  if (!type) return null
  const table = canonicalTable(type)
  const row = db.prepare(`SELECT id,title,course_id,academic_year,semester,status,current_version_id FROM ${table} WHERE id=?`).get(id)
  return row && row.status === 'APPROVED' ? {
    id: row.id, documentType: type, title: row.title, courseId: row.course_id,
    academicYear: row.academic_year, semester: row.semester, currentVersionId: row.current_version_id
  } : null
}

function mapVersion(row) {
  if (!row) return null
  return {
    id: row.id, documentType: row.document_type, documentId: row.document_id,
    versionNumber: row.version_number === null ? null : Number(row.version_number),
    submittedBy: row.submitted_by, contributorUsername: row.contributor_username,
    contributorDisplayName: row.contributor_display_name || row.contributor_username,
    contributorAvatarUrl: row.contributor_avatar_url || '',
    contributorProgram: row.contributor_program || '',
    contributorCohort: row.contributor_cohort || '', revisionType: row.revision_type,
    changeSummary: row.change_summary, originalFileName: row.original_filename,
    mimeType: row.mime_type, fileSize: Number(row.file_size), sha256: row.sha256,
    fileAssetId: row.file_asset_id, status: row.status, reviewedBy: row.reviewed_by,
    reviewerUsername: row.reviewer_username || '', reviewedAt: row.reviewed_at,
    reviewNote: row.review_note || '', sourceVersionId: row.source_version_id,
    sourceVersionNumber: row.source_version_number === null ? null : Number(row.source_version_number),
    createdAt: row.created_at
  }
}

const versionSelect = `SELECT versions.*, contributor.username contributor_username,
  COALESCE(NULLIF(contributor.display_name,''),contributor.username) contributor_display_name,
  contributor.avatar_url contributor_avatar_url,
  contributor.program_code contributor_program, contributor.cohort contributor_cohort,
  reviewer.username reviewer_username,
  source.version_number source_version_number
  FROM document_versions versions
  JOIN users contributor ON contributor.id=versions.submitted_by
  LEFT JOIN users reviewer ON reviewer.id=versions.reviewed_by
  LEFT JOIN document_versions source ON source.id=versions.source_version_id`

export function findDocumentVersion(id) {
  return mapVersion(db.prepare(`${versionSelect} WHERE versions.id=?`).get(id))
}

export function listApprovedVersions(typeValue, documentId) {
  const type = normalizeVersionDocumentType(typeValue)
  if (!type || !findCanonicalDocument(type, documentId)) return null
  return db.prepare(`${versionSelect} WHERE versions.document_type=? AND versions.document_id=? AND versions.status='APPROVED' ORDER BY versions.version_number DESC`)
    .all(type, documentId).map(mapVersion)
}

export function findCurrentDocumentVersion(typeValue, documentId) {
  const document = findCanonicalDocument(typeValue, documentId)
  if (!document?.currentVersionId) return null
  const version = findDocumentVersion(document.currentVersionId)
  return version?.status === 'APPROVED' ? version : null
}

export function findVersionFile(versionId, { approvedOnly = true } = {}) {
  const row = db.prepare(`SELECT versions.id,versions.status,versions.original_filename,versions.mime_type,
    versions.file_size,assets.file_data FROM document_versions versions
    JOIN file_assets assets ON assets.id=versions.file_asset_id WHERE versions.id=?`).get(versionId)
  if (!row || (approvedOnly && row.status !== 'APPROVED')) return null
  return { id: row.id, status: row.status, originalFilename: row.original_filename, mimeType: row.mime_type, fileSize: Number(row.file_size), fileData: row.file_data }
}

export function submitRevision({ documentType, documentId, submittedBy, revisionType, changeSummary, originalFileName, mimeType, fileData, sha256, contentHash = '' }) {
  const type = normalizeVersionDocumentType(documentType)
  const document = findCanonicalDocument(type, documentId)
  if (!document) throw validationError('Document not found', 404)
  if (!REVISION_TYPES.includes(revisionType)) throw validationError('Revision type is invalid')
  const summary = String(changeSummary || '').trim()
  if (summary.length < 5 || summary.length > 1000 || summary.includes('\0')) throw validationError('Change summary must contain 5-1000 characters')
  const duplicate = db.prepare('SELECT id,status,document_type,document_id,version_number FROM document_versions WHERE sha256=? LIMIT 1').get(sha256)
  if (duplicate) throw validationError('ไฟล์นี้มีอยู่ในระบบแล้ว กรุณาเลือกไฟล์ที่มีการแก้ไขจริง', 409)
  const id = crypto.randomUUID()
  db.exec('BEGIN')
  try {
    const asset = getOrCreateFileAsset({ binaryHash: sha256, contentHash, originalFilename: originalFileName, mimeType, fileData })
    db.prepare(`INSERT INTO document_versions(
      id,document_type,document_id,version_number,submitted_by,revision_type,change_summary,
      original_filename,mime_type,file_size,sha256,file_asset_id,status
    ) VALUES(?,?,?,NULL,?,?,?,?,?,?,?,?, 'PENDING')`).run(
      id, type, document.id, submittedBy, revisionType, summary,
      originalFileName, mimeType, Buffer.from(fileData).length, sha256, asset.id)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return findDocumentVersion(id)
}

export function listMyRevisions(userId) {
  return db.prepare(`${versionSelect} WHERE versions.submitted_by=? AND versions.revision_type!='INITIAL' ORDER BY versions.created_at DESC`)
    .all(userId).map(version => {
      const mapped = mapVersion(version)
      const document = findCanonicalDocument(mapped.documentType, mapped.documentId)
      return { ...mapped, documentTitle: document?.title || 'Document unavailable' }
    })
}

export function listRevisionsForAdmin(status = '') {
  const normalized = String(status || '').toUpperCase()
  if (normalized && !['PENDING', 'APPROVED', 'REJECTED'].includes(normalized)) throw validationError('Revision status is invalid')
  const rows = db.prepare(`${versionSelect}
    WHERE versions.revision_type NOT IN ('INITIAL','RESTORE') AND (?='' OR versions.status=?)
    ORDER BY CASE WHEN versions.status='PENDING' THEN versions.created_at ELSE COALESCE(versions.reviewed_at,versions.created_at) END DESC`).all(normalized, normalized)
  return rows.map(row => {
    const version = mapVersion(row)
    const document = findCanonicalDocument(version.documentType, version.documentId)
    const course = document ? db.prepare('SELECT code,name FROM courses WHERE id=?').get(document.courseId) : null
    const current = document ? findCurrentDocumentVersion(document.documentType, document.id) : null
    return { ...version, documentTitle: document?.title || 'Document unavailable', courseCode: course?.code || '', courseName: course?.name || '', academicYear: document?.academicYear || '', semester: document?.semester || '', currentVersionNumber: current?.versionNumber || null }
  })
}

export function approveRevision(id, adminId) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const version = findDocumentVersion(id)
    if (!version) throw validationError('Revision not found', 404)
    if (version.status !== 'PENDING') throw validationError('Revision has already been processed', 409)
    const document = findCanonicalDocument(version.documentType, version.documentId)
    if (!document) throw validationError('Document not found', 404)
    const next = Number(db.prepare(`SELECT COALESCE(MAX(version_number),0)+1 value FROM document_versions WHERE document_type=? AND document_id=? AND status='APPROVED'`).get(version.documentType, version.documentId).value)
    const changed = db.prepare(`UPDATE document_versions SET status='APPROVED',version_number=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'`).run(next, adminId, id)
    if (!changed.changes) throw validationError('Revision has already been processed', 409)
    db.prepare(`UPDATE ${canonicalTable(version.documentType)} SET current_version_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(id, version.documentId)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return findDocumentVersion(id)
}

export function rejectRevision(id, adminId, note) {
  const reason = String(note || '').trim()
  if (!reason || reason.length > 500) throw validationError('Review reason is required and must be at most 500 characters')
  const result = db.prepare(`UPDATE document_versions SET status='REJECTED',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=? WHERE id=? AND status='PENDING'`).run(adminId, reason, id)
  if (!result.changes) {
    if (!findDocumentVersion(id)) throw validationError('Revision not found', 404)
    throw validationError('Revision has already been processed', 409)
  }
  return findDocumentVersion(id)
}

export function restoreDocumentVersion(documentType, documentId, versionId, adminId) {
  const type = normalizeVersionDocumentType(documentType)
  const document = findCanonicalDocument(type, documentId)
  const source = findDocumentVersion(versionId)
  if (!document) throw validationError('Document not found', 404)
  if (!source || source.documentType !== type || source.documentId !== documentId || source.status !== 'APPROVED') throw validationError('Approved source version not found', 404)
  const id = crypto.randomUUID()
  db.exec('BEGIN IMMEDIATE')
  try {
    const next = Number(db.prepare(`SELECT COALESCE(MAX(version_number),0)+1 value FROM document_versions WHERE document_type=? AND document_id=? AND status='APPROVED'`).get(type, documentId).value)
    db.prepare(`INSERT INTO document_versions(
      id,document_type,document_id,version_number,submitted_by,revision_type,change_summary,
      original_filename,mime_type,file_size,sha256,file_asset_id,status,reviewed_by,reviewed_at,source_version_id
    ) VALUES(?,?,?,?,?,'RESTORE',?,?,?,?,?,?,'APPROVED',?,CURRENT_TIMESTAMP,?)`).run(
      id, type, documentId, next, adminId, `Restored from v${source.versionNumber}`,
      source.originalFileName, source.mimeType, source.fileSize, source.sha256, source.fileAssetId, adminId, source.id)
    db.prepare(`UPDATE ${canonicalTable(type)} SET current_version_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(id, documentId)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return findDocumentVersion(id)
}

export function ensureInitialVersion({ documentType, documentId, submittedBy, originalFileName, mimeType, fileSize, sha256, fileAssetId, createdAt = null }) {
  const existing = db.prepare('SELECT id FROM document_versions WHERE document_type=? AND document_id=? AND status=\'APPROVED\' ORDER BY version_number LIMIT 1').get(documentType, documentId)
  if (existing) return findDocumentVersion(existing.id)
  const id = crypto.randomUUID()
  db.prepare(`INSERT INTO document_versions(
    id,document_type,document_id,version_number,submitted_by,revision_type,change_summary,
    original_filename,mime_type,file_size,sha256,file_asset_id,status,reviewed_at,created_at
  ) VALUES(?,?,?,1,?,'INITIAL','Initial published version',?,?,?,?,?,'APPROVED',COALESCE(?,CURRENT_TIMESTAMP),COALESCE(?,CURRENT_TIMESTAMP))`).run(
    id, documentType, documentId, submittedBy, originalFileName, mimeType, fileSize, sha256, fileAssetId, createdAt, createdAt)
  db.prepare(`UPDATE ${canonicalTable(documentType)} SET current_version_id=? WHERE id=?`).run(id, documentId)
  return findDocumentVersion(id)
}
