import { countUsers, listUsers } from '../repositories/user.repository.js'
import { countLecturesByStatus } from '../repositories/lecture.repository.js'
import {
  countSheets,
  countSheetsByStatus,
  findPendingSheets,
  updateSheetStatus
} from '../repositories/sheet.repository.js'
import {
  countUploadRequestsByStatus,
  createUploadRequest,
  findAllUploadRequests,
  findUploadRequestById,
  findUploadRequestFileById,
  findDuplicateMatches,
  publishUploadRequest,
  updateUploadRequestCategory,
  updateUploadRequestStatus
} from '../repositories/uploadRequest.repository.js'
import { createNotification } from '../repositories/notification.repository.js'
import { decodeUploadedFile, validateUploadPayload } from '../services/uploadValidation.service.js'

export function getPendingSheets(_req, res) {
  res.json(findPendingSheets())
}

export function getUploadRequests(_req, res) {
  res.json(findAllUploadRequests().map((request) => {
    const duplicateMatches = findDuplicateMatches(request)
    const duplicateStatus = duplicateMatches.some((match) => match.matchType === 'EXACT_DUPLICATE')
      ? 'EXACT_DUPLICATE'
      : duplicateMatches.some((match) => match.matchType === 'CONTENT_DUPLICATE')
        ? 'CONTENT_DUPLICATE'
        : duplicateMatches.length ? 'POSSIBLE_DUPLICATE' : request.duplicateStatus
    return { ...request, duplicateStatus, duplicateMatches }
  }))
}

export function getUploadRequestFile(req, res, next) {
  try {
    const request = findUploadRequestById(req.params.id)
    if (!request) {
      const error = new Error('Upload request not found')
      error.status = 404
      throw error
    }

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
      `inline; filename*=UTF-8''${encodeURIComponent(file.fileName || 'preview')}`
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export function getUsers(_req, res) {
  res.json(listUsers())
}

export function createUploadRequestAsAdmin(req, res, next) {
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
      instructorId: validated.instructorId,
      uploadDate: String(req.body.uploadDate ?? '').trim()
    })

    if (request.duplicateStatus !== 'NONE') {
      const error = new Error('Duplicate review is required before this file can be published')
      error.status = 409
      error.expose = true
      error.details = findDuplicateMatches(request)
      throw error
    }
    const published = publishUploadRequest(request.id, { adminId: req.user.id })

    createNotification({
      userId: req.user.id,
      title: 'Admin Upload Published',
      message: 'Your administrator upload was published immediately.',
      uploadRequestId: request.id
    })

    res.status(201).json(published)
  } catch (error) {
    next(error)
  }
}

function assertReviewable(request) {
  if (!request) {
    const error = new Error('Upload request not found')
    error.status = 404
    throw error
  }
  if (!['PENDING', 'APPROVED'].includes(request.status)) {
    const error = new Error(`Upload request is already ${request.status.toLowerCase()}`)
    error.status = 409
    throw error
  }
}

function assignCategoryIfPresent(id, body) {
  if (!body.courseId && !body.instructorId && !body.academicYear && !body.documentType && !body.semester) return null
  if (!body.courseId || !body.instructorId || !body.academicYear || !body.documentType || !body.semester) {
    const error = new Error('Course, document type, academic year, and instructor are required')
    error.status = 400
    throw error
  }
  const updated = updateUploadRequestCategory({
    id,
    courseId: body.courseId,
    documentType: body.documentType,
    academicYear: body.academicYear,
    semester: body.semester,
    instructorId: body.instructorId
  })
  if (!updated) {
    const error = new Error('Invalid course or instructor')
    error.status = 400
    throw error
  }
  return updated
}

export function approveUploadRequest(req, res, next) {
  try {
    const request = findUploadRequestById(req.params.id)
    if (request?.status === 'COMPLETED') {
      res.json(request)
      return
    }
    assertReviewable(request)
    assignCategoryIfPresent(request.id, req.body)

    const published = publishUploadRequest(request.id, { adminId: req.user.id })

    createNotification({
      userId: request.userId,
      title: 'Upload Request Approved',
      message: 'Your upload has been approved and is now published for everyone to view and download.',
      uploadRequestId: request.id
    })

    res.json(published)
  } catch (error) {
    next(error)
  }
}

export function rejectUploadRequest(req, res, next) {
  try {
    const request = findUploadRequestById(req.params.id)
    assertReviewable(request)
    const reason = String(req.body.reason ?? '').trim()
    if (!reason) {
      const error = new Error('Rejection reason is required')
      error.status = 400
      throw error
    }

    const updated = updateUploadRequestStatus({
      id: request.id,
      status: 'REJECTED',
      adminId: req.user.id,
      reason,
      rejectionType: req.body.duplicate ? 'DUPLICATE' : 'STANDARD'
    })

    createNotification({
      userId: request.userId,
      title: 'Upload Request Rejected',
      message: `Your upload request was rejected. Reason: ${reason}`,
      uploadRequestId: request.id
    })

    res.json(updated)
  } catch (error) {
    next(error)
  }
}

export function rejectDuplicateUploadRequest(req, res, next) {
  req.body = { ...req.body, duplicate: true, reason: String(req.body.reason ?? '').trim() || 'Duplicate material' }
  rejectUploadRequest(req, res, next)
}

export function approveSheet(req, res) {
  const updated = updateSheetStatus(req.params.id, 'APPROVED')
  if (!updated) {
    res.status(404).json({ message: 'ไม่พบชีท' })
    return
  }
  res.status(204).end()
}

export function rejectSheet(req, res) {
  const updated = updateSheetStatus(req.params.id, 'REJECTED', req.body.reason ?? '')
  if (!updated) {
    res.status(404).json({ message: 'ไม่พบชีท' })
    return
  }
  res.status(204).end()
}

export function getStats(_req, res) {
  res.json({
    totalUsers: countUsers(),
    totalSheets: countSheets(),
    pendingCount: countSheetsByStatus('PENDING'),
    approvedCount: countSheetsByStatus('APPROVED'),
    approvedDocuments: countSheetsByStatus('APPROVED') + countLecturesByStatus('APPROVED'),
    pendingRequests: countUploadRequestsByStatus('PENDING'),
    approvedRequests: countUploadRequestsByStatus('APPROVED'),
    rejectedRequests: countUploadRequestsByStatus('REJECTED')
  })
}
