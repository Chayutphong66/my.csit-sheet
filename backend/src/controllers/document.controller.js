import {
  findCourseSummary,
  findPublicDocument,
  listCourseSummaries,
  listCourseYearDocuments,
  listCourseYears,
  searchDocuments
} from '../repositories/document.repository.js'
import { findLectureFileByLectureId } from '../repositories/lectureFile.repository.js'
import { findSheetFileBySheetId } from '../repositories/sheetFile.repository.js'
import {
  findHelpfulState,
  recordDocumentInteraction,
  setDocumentHelpful
} from '../repositories/communityInteraction.repository.js'
import crypto from 'node:crypto'
import { calculateContentFingerprint } from '../services/contentFingerprint.service.js'
import { decodeUploadedFile, validateFileMetadata } from '../services/uploadValidation.service.js'
import {
  findCurrentDocumentVersion, findDocumentVersion, findVersionFile,
  listApprovedVersions, listMyRevisions, submitRevision, REVISION_TYPES
} from '../repositories/documentVersion.repository.js'
import { withStars } from '../repositories/profile.repository.js'
import { discardUploadSession, resolveUploadBody } from '../services/uploadSession.service.js'

function notFound(message = 'Document not found') {
  const error = new Error(message)
  error.status = 404
  return error
}

function publicDocument(document) {
  const { uploaderId, ...safeDocument } = document
  return safeDocument
}

function requestedType(req) {
  const value = String(req.query.type ?? '').trim().toLowerCase()
  if (!value) return ''
  if (value === 'lecture') return 'Lecture'
  if (value === 'sheet') return 'Sheet'
  const error = new Error('Document type must be Lecture or Sheet')
  error.status = 400
  throw error
}

export async function getCourses(req, res, next) {
  try { res.json(await listCourseSummaries(requestedType(req))) } catch (error) { next(error) }
}

export async function getCourseYears(req, res, next) {
  let documentType
  try { documentType = requestedType(req) } catch (error) { return next(error) }
  const course = await findCourseSummary(req.params.id, documentType)
  if (!course) return next(notFound('Course not found'))
  res.json({ course, documentType: documentType || null, years: await listCourseYears(course.id, documentType) })
}

export async function getCourseYear(req, res, next) {
  let documentType
  try { documentType = requestedType(req) } catch (error) { return next(error) }
  const course = await findCourseSummary(req.params.id, documentType)
  if (!course) return next(notFound('Course not found'))
  const documents = (await listCourseYearDocuments(course.id, req.params.year, documentType, req.user.id)).map(publicDocument)
  const semesters = documents.reduce((groups, document) => {
    let group = groups.find((item) => item.semester === document.semester)
    if (!group) {
      group = { semester: document.semester, documentCount: 0, documents: [] }
      groups.push(group)
    }
    group.documentCount += 1
    group.documents.push(document)
    return groups
  }, [])
  res.json({ course, documentType: documentType || null, academicYear: req.params.year, semesters })
}

export async function search(req, res, next) {
  try {
    const documentType = requestedType(req)
    res.json({ query: String(req.query.q ?? '').trim(), documentType: documentType || null, documents: (await searchDocuments(req.query.q, documentType, req.user.id)).map(publicDocument) })
  } catch (error) { next(error) }
}

export async function getDocument(req, res, next) {
  const document = await findPublicDocument(req.params.type, req.params.id, req.user.id)
  if (!document) return next(notFound())
  const helpful = await findHelpfulState({
    userId: req.user.id,
    documentType: document.documentType,
    documentId: document.id
  })
  const starred = (await withStars([document], req.user.id))[0]
  res.json({ ...publicDocument(starred), ...helpful, currentVersion: await findCurrentDocumentVersion(document.documentType, document.id) })
}

export async function getVersions(req, res, next) {
  try {
    const versions = await listApprovedVersions(req.params.type, req.params.id)
    if (!versions) throw notFound()
    res.json({ versions })
  } catch (error) { next(error) }
}

export async function createRevision(req, res, next) {
  let sessionId = null
  try {
    const resolved = await resolveUploadBody(req.body, req.user.id)
    sessionId = resolved.sessionId
    const { fileName, fileType } = validateFileMetadata(resolved.body)
    const fileData = decodeUploadedFile(resolved.body.fileData, fileType)
    const revisionType = String(req.body.revisionType || '').trim().toUpperCase()
    if (!REVISION_TYPES.includes(revisionType)) {
      const error = new Error('Revision type is invalid'); error.status = 400; throw error
    }
    const sha256 = crypto.createHash('sha256').update(fileData).digest('hex')
    const revision = await submitRevision({
      documentType: req.params.type, documentId: req.params.id, submittedBy: req.user.id,
      revisionType, changeSummary: req.body.changeSummary, originalFileName: fileName,
      mimeType: fileType, fileData, sha256, contentHash: calculateContentFingerprint(fileData, fileType)
    })
    if (sessionId) await discardUploadSession(sessionId)
    res.status(201).json(revision)
  } catch (error) { next(error) }
}

export async function getMyRevisions(req, res) {
  res.json({ revisions: await listMyRevisions(req.user.id) })
}

async function sendVersionFile(req, res, next, disposition) {
  try {
    const version = await findDocumentVersion(req.params.versionId)
    if (!version || version.documentId !== req.params.id || version.documentType.toLowerCase() !== String(req.params.type).toLowerCase() || version.status !== 'APPROVED') throw notFound('Version not found')
    const file = await findVersionFile(version.id)
    if (!file?.fileData) throw notFound('Version file unavailable')
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalFilename || 'document')}`)
    res.send(Buffer.from(file.fileData))
  } catch (error) { next(error) }
}

export async function viewVersion(req, res, next) { await sendVersionFile(req, res, next, 'inline') }
export async function downloadVersion(req, res, next) { await sendVersionFile(req, res, next, 'attachment') }

async function sendFile(req, res, next, disposition) {
  try {
    const document = await findPublicDocument(req.params.type, req.params.id)
    if (!document) throw notFound()
    const currentVersion = await findCurrentDocumentVersion(document.documentType, document.id)
    const file = currentVersion
      ? await findVersionFile(currentVersion.id)
      : document.documentType === 'Lecture'
        ? await findLectureFileByLectureId(document.id)
        : await findSheetFileBySheetId(document.id)
    if (!file?.fileData) throw notFound()
    await recordDocumentInteraction({
      userId: req.user.id,
      document,
      interactionType: disposition === 'attachment' ? 'DOWNLOAD' : 'VIEW'
    })
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalFilename || 'document')}`)
    res.send(Buffer.from(file.fileData))
  } catch (error) {
    next(error)
  }
}

export async function viewDocument(req, res, next) {
  await sendFile(req, res, next, 'inline')
}

export async function downloadDocument(req, res, next) {
  await sendFile(req, res, next, 'attachment')
}

export async function updateHelpful(req, res, next) {
  try {
    if (typeof req.body?.helpful !== 'boolean') {
      const error = new Error('helpful must be a boolean')
      error.status = 400
      error.expose = true
      throw error
    }
    const document = await findPublicDocument(req.params.type, req.params.id)
    if (!document) throw notFound()
    res.json(await setDocumentHelpful({ userId: req.user.id, document, helpful: req.body.helpful }))
  } catch (error) {
    next(error)
  }
}
