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

export function getCourses(req, res, next) {
  try { res.json(listCourseSummaries(requestedType(req))) } catch (error) { next(error) }
}

export function getCourseYears(req, res, next) {
  let documentType
  try { documentType = requestedType(req) } catch (error) { return next(error) }
  const course = findCourseSummary(req.params.id, documentType)
  if (!course) return next(notFound('Course not found'))
  res.json({ course, documentType: documentType || null, years: listCourseYears(course.id, documentType) })
}

export function getCourseYear(req, res, next) {
  let documentType
  try { documentType = requestedType(req) } catch (error) { return next(error) }
  const course = findCourseSummary(req.params.id, documentType)
  if (!course) return next(notFound('Course not found'))
  const documents = listCourseYearDocuments(course.id, req.params.year, documentType, req.user.id).map(publicDocument)
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

export function search(req, res, next) {
  try {
    const documentType = requestedType(req)
    res.json({ query: String(req.query.q ?? '').trim(), documentType: documentType || null, documents: searchDocuments(req.query.q, documentType, req.user.id).map(publicDocument) })
  } catch (error) { next(error) }
}

export function getDocument(req, res, next) {
  const document = findPublicDocument(req.params.type, req.params.id, req.user.id)
  if (!document) return next(notFound())
  const helpful = findHelpfulState({
    userId: req.user.id,
    documentType: document.documentType,
    documentId: document.id
  })
  res.json({ ...publicDocument(document), ...helpful })
}

function sendFile(req, res, next, disposition) {
  try {
    const document = findPublicDocument(req.params.type, req.params.id)
    if (!document) throw notFound()
    const file = document.documentType === 'Lecture'
      ? findLectureFileByLectureId(document.id)
      : findSheetFileBySheetId(document.id)
    if (!file?.fileData) throw notFound()
    recordDocumentInteraction({
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

export function viewDocument(req, res, next) {
  sendFile(req, res, next, 'inline')
}

export function downloadDocument(req, res, next) {
  sendFile(req, res, next, 'attachment')
}

export function updateHelpful(req, res, next) {
  try {
    if (typeof req.body?.helpful !== 'boolean') {
      const error = new Error('helpful must be a boolean')
      error.status = 400
      error.expose = true
      throw error
    }
    const document = findPublicDocument(req.params.type, req.params.id)
    if (!document) throw notFound()
    res.json(setDocumentHelpful({ userId: req.user.id, document, helpful: req.body.helpful }))
  } catch (error) {
    next(error)
  }
}
