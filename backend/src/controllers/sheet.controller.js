import {
  findSheetsByUploaderId,
  findRecommendedSheets,
  findApprovedSheets,
  findSheetById
} from '../repositories/sheet.repository.js'
import {
  createUploadRequest,
  findDuplicateMatches,
  findUploadRequestById,
  findUploadRequestFileById,
  findUploadRequestsByUserId,
  findContributionSummaryByUserId,
  publishUploadRequest
} from '../repositories/uploadRequest.repository.js'
import { listAcademicPeriods, listCurriculumCourses, listPrograms } from '../repositories/academic.repository.js'
import { findApprovedLectures } from '../repositories/lecture.repository.js'
import { findSheetFileBySheetId } from '../repositories/sheetFile.repository.js'
import {
  createNotification,
  findNotificationsByUserId,
  markNotificationRead
} from '../repositories/notification.repository.js'
import { decodeUploadedFile, validateUploadPayload } from '../services/uploadValidation.service.js'
import crypto from 'node:crypto'
import { calculateContentFingerprint } from '../services/contentFingerprint.service.js'
import { recordDocumentInteraction } from '../repositories/communityInteraction.repository.js'
import { findCurrentDocumentVersion, findVersionFile } from '../repositories/documentVersion.repository.js'
import { discardUploadSession, resolveUploadBody } from '../services/uploadSession.service.js'

function publicSheet(sheet) {
  const { uploaderId, uploaderEmail, rejectReason, sourceRequestId, ...safeSheet } = sheet
  return { ...safeSheet, documentType: 'Sheet', hasFile: Boolean(sheet.hasFile) }
}

function publicLectureForCatalog(lecture) {
  const { uploaderId, sourceRequestId, ...safeLecture } = lecture
  return { ...safeLecture, documentType: 'Lecture', hasFile: Boolean(lecture.hasFile) }
}

export async function getMySheets(req, res) {
  const mine = (await findSheetsByUploaderId(req.user.id)).map((sheet) => {
    const { uploaderUsername, ...rest } = publicSheet(sheet)
    return rest
  })
  res.json(mine)
}

export async function getAllSheets(_req, res) {
  res.json((await findApprovedSheets()).map(publicSheet))
}

// Public download for an approved sheet. Any authenticated user may download it from
// sheet_files; the private upload-request endpoint is not the public source of truth.
export async function getSheetFile(req, res, next) {
  try {
    const sheet = await findSheetById(req.params.id)
    if (!sheet || sheet.status !== 'APPROVED') {
      const error = new Error('Sheet not found')
      error.status = 404
      throw error
    }

    const currentVersion = await findCurrentDocumentVersion('Sheet', sheet.id)
    const file = currentVersion ? await findVersionFile(currentVersion.id) : await findSheetFileBySheetId(sheet.id)
    if (!file || !file.fileData) {
      const error = new Error('No file is stored for this sheet')
      error.status = 404
      throw error
    }

    await recordDocumentInteraction({
      userId: req.user.id,
      document: { id: sheet.id, documentType: 'Sheet', uploaderId: sheet.uploaderId },
      interactionType: 'DOWNLOAD'
    })

    const buffer = Buffer.from(file.fileData)
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.originalFilename || sheet.title || 'download')}`
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export async function getRecommendedSheets(req, res) {
  const recommended = (await findRecommendedSheets({
    limit: 6,
    excludeUploaderId: req.user.id
  })).map(publicSheet)
  res.json(recommended)
}

function assertRequestOwner(req, request) {
  if (!request) {
    const error = new Error('Upload request not found')
    error.status = 404
    throw error
  }
  if (request.userId !== req.user.id) {
    const error = new Error('You can only access your own upload requests')
    error.status = 403
    throw error
  }
}

export async function createRequest(req, res, next) {
  let sessionId = null
  try {
    const resolved = await resolveUploadBody(req.body, req.user.id)
    sessionId = resolved.sessionId
    const validated = await validateUploadPayload(resolved.body)
    const fileData = decodeUploadedFile(resolved.body.fileData, validated.fileType)
    const request = await createUploadRequest({
      userId: req.user.id,
      title: validated.title,
      fileName: validated.fileName,
      fileSize: fileData.length,
      fileType: validated.fileType,
      fileData,
      courseId: validated.courseId,
      documentType: validated.documentType,
      academicYear: validated.academicYear,
      semester: validated.semester,
      instructorIds: validated.instructorIds,
      courseOfferingId: validated.courseOfferingId,
      programId: validated.programId,
      description: validated.description,
      suggestionIds: validated.suggestionIds
    })

    await createNotification({
      userId: req.user.id,
      title: 'Upload Request Submitted',
      message: 'Your upload request has been sent and is waiting for administrator approval.',
      uploadRequestId: request.id
    })

    if (sessionId) await discardUploadSession(sessionId)

    res.status(201).json(request)
  } catch (error) {
    next(error)
  }
}

export async function previewDuplicateRequests(req, res, next) {
  try {
    const { body } = await resolveUploadBody(req.body, req.user.id)
    const validated = await validateUploadPayload(body)
    const fileData = decodeUploadedFile(body.fileData, validated.fileType)
    const fileHash = crypto.createHash('sha256').update(fileData).digest('hex')
    const contentHash = calculateContentFingerprint(fileData, validated.fileType)
    const matches = await findDuplicateMatches({
      id: '', title: validated.title, fileHash, contentHash,
      courseId: validated.courseId, academicYear: validated.academicYear,
      semester: validated.semester, documentType: validated.documentType
    })
    const safeMatches = matches.map((match, index) => match.publicDocumentId ? match : {
      source: 'REQUEST',
      id: `pending-${index + 1}`,
      title: 'A matching document request is already pending review',
      documentType: match.documentType,
      status: 'PENDING',
      matchType: match.matchType,
      binaryMatch: match.binaryMatch,
      contentMatch: match.contentMatch,
      publicDocumentId: null
    })
    res.json({
      exactDuplicate: safeMatches.some((match) => match.matchType === 'EXACT_DUPLICATE'),
      matches: safeMatches
    })
  } catch (error) {
    next(error)
  }
}

export async function getMyUploadRequests(req, res) {
  res.json(await findUploadRequestsByUserId(req.user.id))
}

export async function getMyContributions(req, res) {
  res.json(await findContributionSummaryByUserId(req.user.id))
}

export async function getUploadRequest(req, res, next) {
  try {
    const request = await findUploadRequestById(req.params.id)
    assertRequestOwner(req, request)
    res.json(request)
  } catch (error) {
    next(error)
  }
}

export async function getUploadRequestFile(req, res, next) {
  try {
    const request = await findUploadRequestById(req.params.id)
    assertRequestOwner(req, request)

    const file = await findUploadRequestFileById(request.id)
    if (!file || !file.fileData) {
      const error = new Error('No file is stored for this request')
      error.status = 404
      throw error
    }

    const buffer = Buffer.from(file.fileData)
    res.setHeader('Content-Type', file.fileType || 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName || 'download')}`
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

// Legacy endpoint kept for backward compatibility. Publishing now happens automatically
// the moment an admin approves a request. If a client still calls this after publication,
// return the completed request without creating duplicates.
export async function completeRequest(req, res, next) {
  try {
    const request = await findUploadRequestById(req.params.id)
    assertRequestOwner(req, request)

    if (request.status === 'PENDING') {
      const error = new Error('This request is still waiting for administrator approval')
      error.status = 409
      throw error
    }

    if (request.status === 'COMPLETED') {
      res.json(request)
      return
    }

    if (request.status !== 'APPROVED') {
      const error = new Error(`This request cannot be published because it is ${request.status.toLowerCase()}`)
      error.status = 409
      throw error
    }

    const published = await publishUploadRequest(request.id)
    res.json(published)
  } catch (error) {
    next(error)
  }
}

export async function getCatalog(req, res) {
  const type = String(req.query.type ?? '').toLowerCase()
  const documents = [
    ...(['', 'lectures'].includes(type)
      ? (await findApprovedLectures()).map(publicLectureForCatalog)
      : []),
    ...(['', 'sheets'].includes(type)
      ? (await findRecommendedSheets({ limit: 100, excludeUploaderId: null })).map(publicSheet)
      : [])
  ]

  const courses = documents.reduce((items, document) => {
    const existing = items.find((item) => item.name === document.subject)
    if (existing) {
      existing.count += 1
      existing.documents.push(document)
    } else {
      items.push({ name: document.subject, count: 1, documents: [document] })
    }
    return items
  }, [])

  res.json({ courses })
}

export async function getMetadata(_req, res) {
  const [courses, programs, periods] = await Promise.all([
    listCurriculumCourses(), listPrograms(), listAcademicPeriods()
  ])
  res.json({
    courses,
    programs,
    ...periods,
    documentTypes: ['Lecture', 'Sheet']
  })
}

export async function getNotifications(req, res) {
  res.json(await findNotificationsByUserId(req.user.id))
}

export async function readNotification(req, res, next) {
  try {
    const updated = await markNotificationRead({ id: req.params.id, userId: req.user.id })
    if (!updated) {
      const error = new Error('Notification not found')
      error.status = 404
      throw error
    }
    res.status(204).end()
  } catch (error) {
    next(error)
  }
}
