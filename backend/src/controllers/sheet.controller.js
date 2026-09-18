import {
  findSheetsByUploaderId,
  findRecommendedSheets,
  findApprovedSheets,
  findSheetById
} from '../repositories/sheet.repository.js'
import {
  createUploadRequest,
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
import { recordDocumentInteraction } from '../repositories/communityInteraction.repository.js'

function publicSheet(sheet) {
  const { uploaderId, uploaderEmail, rejectReason, sourceRequestId, ...safeSheet } = sheet
  return { ...safeSheet, documentType: 'Sheet', hasFile: Boolean(sheet.hasFile) }
}

function publicLectureForCatalog(lecture) {
  const { uploaderId, sourceRequestId, ...safeLecture } = lecture
  return { ...safeLecture, documentType: 'Lecture', hasFile: Boolean(lecture.hasFile) }
}

export function getMySheets(req, res) {
  const mine = findSheetsByUploaderId(req.user.id).map((sheet) => {
    const { uploaderUsername, ...rest } = publicSheet(sheet)
    return rest
  })
  res.json(mine)
}

export function getAllSheets(_req, res) {
  res.json(findApprovedSheets().map(publicSheet))
}

// Public download for an approved sheet. Any authenticated user may download it from
// sheet_files; the private upload-request endpoint is not the public source of truth.
export function getSheetFile(req, res, next) {
  try {
    const sheet = findSheetById(req.params.id)
    if (!sheet || sheet.status !== 'APPROVED') {
      const error = new Error('Sheet not found')
      error.status = 404
      throw error
    }

    const file = findSheetFileBySheetId(sheet.id)
    if (!file || !file.fileData) {
      const error = new Error('No file is stored for this sheet')
      error.status = 404
      throw error
    }

    recordDocumentInteraction({
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

export function getRecommendedSheets(req, res) {
  const recommended = findRecommendedSheets({
    limit: 6,
    excludeUploaderId: req.user.id
  }).map(publicSheet)
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

export function createRequest(req, res, next) {
  try {
    const validated = validateUploadPayload(req.body)
    const fileData = decodeUploadedFile(req.body.fileData, validated.fileType)
    const request = createUploadRequest({
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

    createNotification({
      userId: req.user.id,
      title: 'Upload Request Submitted',
      message: 'Your upload request has been sent and is waiting for administrator approval.',
      uploadRequestId: request.id
    })

    res.status(201).json(request)
  } catch (error) {
    next(error)
  }
}

export function getMyUploadRequests(req, res) {
  res.json(findUploadRequestsByUserId(req.user.id))
}

export function getMyContributions(req, res) {
  res.json(findContributionSummaryByUserId(req.user.id))
}

export function getUploadRequest(req, res, next) {
  try {
    const request = findUploadRequestById(req.params.id)
    assertRequestOwner(req, request)
    res.json(request)
  } catch (error) {
    next(error)
  }
}

export function getUploadRequestFile(req, res, next) {
  try {
    const request = findUploadRequestById(req.params.id)
    assertRequestOwner(req, request)

    const file = findUploadRequestFileById(request.id)
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
export function completeRequest(req, res, next) {
  try {
    const request = findUploadRequestById(req.params.id)
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

    const published = publishUploadRequest(request.id)
    res.json(published)
  } catch (error) {
    next(error)
  }
}

export function getCatalog(req, res) {
  const type = String(req.query.type ?? '').toLowerCase()
  const documents = [
    ...(['', 'lectures'].includes(type)
      ? findApprovedLectures().map(publicLectureForCatalog)
      : []),
    ...(['', 'sheets'].includes(type)
      ? findRecommendedSheets({ limit: 100, excludeUploaderId: null }).map(publicSheet)
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

export function getMetadata(_req, res) {
  res.json({
    courses: listCurriculumCourses(),
    programs: listPrograms(),
    ...listAcademicPeriods(),
    documentTypes: ['Lecture', 'Sheet']
  })
}

export function getNotifications(req, res) {
  res.json(findNotificationsByUserId(req.user.id))
}

export function readNotification(req, res, next) {
  try {
    const updated = markNotificationRead({ id: req.params.id, userId: req.user.id })
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
