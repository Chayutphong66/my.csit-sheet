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
import { createTeacher, listTeachers, updateTeacher, teacherOfferings, listOfferings, saveOffering, listTeacherSuggestions, reviewTeacherSuggestion, getCurriculumCourse } from '../repositories/academic.repository.js'
import { academicYear, semester, section, teacherName, email, validationError } from '../services/academicValidation.service.js'
import { courseImportToken, importCourseWorkbook, listCourseImports, previewCourseWorkbook } from '../data/importCourseOfferings.js'
import {
  approveRevision, findDocumentVersion, findVersionFile, listRevisionsForAdmin,
  rejectRevision, restoreDocumentVersion
} from '../repositories/documentVersion.repository.js'
import { discardUploadSession, resolveUploadBody } from '../services/uploadSession.service.js'
import { decideProfileChangeRequest as decideProfileRequest, listProfileChangeRequests, notifyFollowersOfDocument } from '../repositories/community.repository.js'
import { findUserById } from '../repositories/user.repository.js'
import { sendEmail } from '../services/email.service.js'

const COURSE_IMPORT_MAX_BYTES = 20 * 1024 * 1024

function courseImportPayload(body) {
  const fileName = String(body.fileName ?? '').trim()
  const program = String(body.program ?? '').trim().toUpperCase()
  if (!/\.xlsx$/i.test(fileName)) throw validationError('A .xlsx registrar workbook is required')
  if (!['CS', 'IT'].includes(program)) throw validationError('Program must be CS or IT')
  if (typeof body.fileData !== 'string' || !body.fileData.trim()) throw validationError('Workbook data is required')
  const buffer = Buffer.from(body.fileData, 'base64')
  if (!buffer.length || buffer.length > COURSE_IMPORT_MAX_BYTES) throw validationError('Workbook must be between 1 byte and 20 MB')
  return { fileName, program, buffer }
}

export async function getPendingSheets(_req, res) {
  res.json(await findPendingSheets())
}

export async function getUploadRequests(req, res, next) {
  try {
    const status = String(req.query.status ?? '').trim().toUpperCase()
    if (status && !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      throw validationError('Invalid review status')
    }
    const requests = await findAllUploadRequests(status)
    res.json(await Promise.all(requests.map(async (request) => {
      const duplicateMatches = request.status === 'COMPLETED' ? [] : await findDuplicateMatches(request)
      const duplicateStatus = duplicateMatches.some((match) => match.matchType === 'EXACT_DUPLICATE')
        ? 'EXACT_DUPLICATE'
        : duplicateMatches.some((match) => match.matchType === 'CONTENT_DUPLICATE')
          ? 'CONTENT_DUPLICATE'
          : duplicateMatches.length ? 'POSSIBLE_DUPLICATE' : request.duplicateStatus
      return { ...request, duplicateStatus, duplicateMatches }
    })))
  } catch (error) {
    next(error)
  }
}

export async function getUploadRequestFile(req, res, next) {
  try {
    const request = await findUploadRequestById(req.params.id)
    if (!request) {
      const error = new Error('Upload request not found')
      error.status = 404
      throw error
    }

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
      `inline; filename*=UTF-8''${encodeURIComponent(file.fileName || 'preview')}`
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export async function getUsers(_req, res) {
  res.json(await listUsers())
}

export async function getProfileChangeRequests(req, res, next) {
  try {
    const status = String(req.query.status || '').toUpperCase()
    if (status && !['PENDING','APPROVED','REJECTED'].includes(status)) return res.status(400).json({ message: 'Invalid status' })
    res.json(await listProfileChangeRequests({ status }))
  } catch (error) { next(error) }
}

export async function decideProfileChangeRequest(req, res, next) {
  try {
    const status = String(req.body.status || '').toUpperCase()
    if (!['APPROVED','REJECTED'].includes(status)) return res.status(400).json({ message: 'Status must be APPROVED or REJECTED' })
    const reason = String(req.body.reason || '').trim()
    if (status === 'REJECTED' && !reason) return res.status(400).json({ message: 'Rejection reason is required' })
    const request = await decideProfileRequest({ id: req.params.id, reviewerId: req.user.id, status, reason })
    if (!request) return res.status(404).json({ message: 'Request not found' })
    const user = await findUserById(request.user_id)
    await sendEmail({ userId: user.id, to: user.email, template: 'profileChangeDecision', data: { category: request.category, requestedValue: request.requested_value, status, reason } })
    res.json(request)
  } catch (error) { next(error) }
}

export async function createUploadRequestAsAdmin(req, res, next) {
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
      suggestionIds: validated.suggestionIds,
      uploadDate: String(req.body.uploadDate ?? '').trim()
    })

    if (request.duplicateStatus !== 'NONE') {
      const error = new Error('Duplicate review is required before this file can be published')
      error.status = 409
      error.expose = true
      error.details = await findDuplicateMatches(request)
      throw error
    }
    const published = await publishUploadRequest(request.id, { adminId: req.user.id })
    await notifyFollowersOfDocument({ uploaderId: req.user.id, document: published })

    await createNotification({
      userId: req.user.id,
      title: 'Admin Upload Published',
      message: 'Your administrator upload was published immediately.',
      uploadRequestId: request.id
    })

    if (sessionId) await discardUploadSession(sessionId)

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

async function assignCategoryIfPresent(id, body) {
  if (!body.courseId && !body.instructorId && !body.academicYear && !body.documentType && !body.semester) return null
  if (!body.courseId || !body.academicYear || !body.documentType || !body.semester) {
    const error = new Error('Course, document type, academic year, and semester are required')
    error.status = 400
    throw error
  }
  const updated = await updateUploadRequestCategory({
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

export async function approveUploadRequest(req, res, next) {
  try {
    const request = await findUploadRequestById(req.params.id)
    if (request?.status === 'COMPLETED') {
      res.json(request)
      return
    }
    assertReviewable(request)
    await assignCategoryIfPresent(request.id, req.body)

    const published = await publishUploadRequest(request.id, { adminId: req.user.id })
    await notifyFollowersOfDocument({ uploaderId: request.userId, document: published })

    await createNotification({
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

export async function rejectUploadRequest(req, res, next) {
  try {
    const request = await findUploadRequestById(req.params.id)
    assertReviewable(request)
    const reason = String(req.body.reason ?? '').trim()
    if (!reason) {
      const error = new Error('Rejection reason is required')
      error.status = 400
      throw error
    }

    const updated = await updateUploadRequestStatus({
      id: request.id,
      status: 'REJECTED',
      adminId: req.user.id,
      reason,
      rejectionType: req.body.duplicate ? 'DUPLICATE' : 'STANDARD'
    })

    await createNotification({
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

export async function rejectDuplicateUploadRequest(req, res, next) {
  req.body = { ...req.body, duplicate: true, reason: String(req.body.reason ?? '').trim() || 'Duplicate material' }
  await rejectUploadRequest(req, res, next)
}

export async function approveSheet(req, res) {
  const updated = await updateSheetStatus(req.params.id, 'APPROVED')
  if (!updated) {
    res.status(404).json({ message: 'ไม่พบชีท' })
    return
  }
  res.status(204).end()
}

export async function rejectSheet(req, res) {
  const updated = await updateSheetStatus(req.params.id, 'REJECTED', req.body.reason ?? '')
  if (!updated) {
    res.status(404).json({ message: 'ไม่พบชีท' })
    return
  }
  res.status(204).end()
}

export async function getStats(_req, res) {
  const [totalUsers, totalSheets, pendingCount, approvedCount, approvedLectures, pendingRequests, approvedRequests, rejectedRequests] = await Promise.all([
    countUsers(), countSheets(), countSheetsByStatus('PENDING'), countSheetsByStatus('APPROVED'),
    countLecturesByStatus('APPROVED'), countUploadRequestsByStatus('PENDING'),
    countUploadRequestsByStatus('APPROVED'), countUploadRequestsByStatus('REJECTED')
  ])
  res.json({
    totalUsers, totalSheets, pendingCount, approvedCount,
    approvedDocuments: Number(approvedCount) + Number(approvedLectures),
    pendingRequests, approvedRequests, rejectedRequests
  })
}

export async function previewCourseImport(req, res, next) {
  try {
    const resolved = await resolveUploadBody(req.body, req.user.id)
    const payload = courseImportPayload(resolved.body)
    const preview = await previewCourseWorkbook(payload.buffer, payload.program)
    res.json({ ...preview, fileName: payload.fileName, previewToken: courseImportToken(payload.buffer, payload.program) })
  } catch (error) { next(error) }
}

export async function confirmCourseImport(req, res, next) {
  let sessionId = null
  try {
    const resolved = await resolveUploadBody(req.body, req.user.id)
    sessionId = resolved.sessionId
    const payload = courseImportPayload(resolved.body)
    if (resolved.body.previewToken !== courseImportToken(payload.buffer, payload.program)) throw validationError('Import preview is missing or no longer matches this workbook', 409)
    if (resolved.body.destructiveSync === true && resolved.body.confirmDestructive !== true) throw validationError('Explicit destructive synchronization confirmation is required', 409)
    const result = await importCourseWorkbook(payload.buffer, payload.program, undefined, {
      fileName: payload.fileName,
      importedByUserId: req.user.id,
      destructiveSync: resolved.body.destructiveSync === true
    })
    if (sessionId) await discardUploadSession(sessionId)
    res.status(201).json(result)
  } catch (error) { next(error) }
}

export async function getCourseImportHistory(_req, res) {
  res.json({ imports: await listCourseImports() })
}

export async function getRevisions(req, res, next) {
  try { res.json({ revisions: await listRevisionsForAdmin(req.query.status) }) } catch (error) { next(error) }
}

export async function getRevision(req, res, next) {
  try {
    const revision = await findDocumentVersion(req.params.id)
    if (!revision) throw validationError('Revision not found', 404)
    const detail = (await listRevisionsForAdmin('')).find(item => item.id === revision.id)
    res.json(detail || revision)
  } catch (error) { next(error) }
}

export async function getRevisionFile(req, res, next) {
  try {
    const file = await findVersionFile(req.params.id, { approvedOnly: false })
    if (!file?.fileData) throw validationError('Revision file unavailable', 404)
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalFilename || 'revision')}`)
    res.send(Buffer.from(file.fileData))
  } catch (error) { next(error) }
}

export async function approveDocumentRevision(req, res, next) {
  try {
    const revision = await approveRevision(req.params.id, req.user.id)
    await createNotification({ userId: revision.submittedBy, title: 'Revision Approved', message: `Your revision was published as v${revision.versionNumber}.` })
    res.json(revision)
  } catch (error) { next(error) }
}

export async function rejectDocumentRevision(req, res, next) {
  try {
    const revision = await rejectRevision(req.params.id, req.user.id, req.body.reason)
    await createNotification({ userId: revision.submittedBy, title: 'Revision Rejected', message: `Your revision was rejected: ${revision.reviewNote}` })
    res.json(revision)
  } catch (error) { next(error) }
}

export async function restoreVersion(req, res, next) {
  try { res.status(201).json(await restoreDocumentVersion(req.params.type, req.params.documentId, req.params.versionId, req.user.id)) }
  catch (error) { next(error) }
}

export async function getTeachers(req, res) {
  res.json({ teachers: await listTeachers({ search: String(req.query.search ?? '').slice(0, 100), includeInactive: true }) })
}
export async function addTeacher(req, res, next) {
  try {
    const teacher = await createTeacher({ name: teacherName(req.body.name), email: email(req.body.email), active: req.body.active !== false })
    if (!teacher) throw validationError('มีอาจารย์ชื่อนี้อยู่แล้ว', 409)
    res.status(201).json(teacher)
  } catch (error) { next(error) }
}
export async function editTeacher(req, res, next) {
  try {
    if (req.body.active !== undefined && typeof req.body.active !== 'boolean') throw validationError('active must be a boolean')
    const teacher = await updateTeacher(req.params.id, { name: req.body.name === undefined ? undefined : teacherName(req.body.name), email: req.body.email === undefined ? undefined : email(req.body.email), active: req.body.active })
    if (!teacher) throw validationError('ไม่พบอาจารย์หรือชื่อซ้ำกับรายการเดิม', 409)
    res.json({ ...teacher, offerings: await teacherOfferings(teacher.id) })
  } catch (error) { next(error) }
}
export async function getTeacherOfferings(req, res, next) {
  const teacher = (await listTeachers({ includeInactive: true })).find(item => item.id === req.params.id)
  if (!teacher) return next(validationError('Teacher not found', 404))
  res.json({ teacher, offerings: await teacherOfferings(teacher.id) })
}
export async function getOfferings(_req, res) { res.json({ offerings: await listOfferings() }) }
export async function putOffering(req, res, next) {
  try {
    const courseId = String(req.body.courseId ?? '')
    if (!await getCurriculumCourse(courseId)) throw validationError('Course not found', 404)
    if (!Array.isArray(req.body.teacherIds) || req.body.teacherIds.some(id => typeof id !== 'string')) throw validationError('teacherIds must be an array')
    const offering = await saveOffering({ courseId, academicYear: academicYear(req.body.academicYear), semester: semester(req.body.semester), section: section(req.body.section), teacherIds: req.body.teacherIds })
    if (!offering) throw validationError('One or more teachers do not exist')
    res.json(offering)
  } catch (error) { next(error) }
}
export async function getTeacherSuggestions(req, res, next) {
  const status = String(req.query.status ?? '').toUpperCase()
  if (status && !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) return next(validationError('Invalid suggestion status'))
  res.json({ suggestions: await listTeacherSuggestions(status) })
}
export async function decideTeacherSuggestion(req, res, next) {
  try {
    const decision = req.body.decision || (req.body.approve === true ? 'APPROVE_GLOBAL' : req.body.approve === false ? 'REJECT' : '')
    if (!['APPROVE_GLOBAL', 'APPROVE_DOCUMENT', 'REJECT'].includes(decision)) throw validationError('Invalid teacher suggestion decision')
    const reason = String(req.body.reason ?? '').trim().slice(0, 500)
    if (decision === 'REJECT' && !reason) throw validationError('Rejection reason is required')
    const suggestion = await reviewTeacherSuggestion({ id: req.params.id, adminId: req.user.id, decision, reason })
    if (!suggestion) throw validationError('Suggestion not found or already reviewed', 409)
    await createNotification({ userId: suggestion.submittedByUserId, type: 'TEACHER_SUGGESTION', title: decision === 'REJECT' ? 'Teacher Suggestion Rejected' : 'Teacher Suggestion Approved', message: decision === 'APPROVE_GLOBAL' ? `ข้อมูล ${suggestion.teacherName} ได้รับการอนุมัติและเชื่อมกับรายวิชาแล้ว` : decision === 'APPROVE_DOCUMENT' ? `ข้อมูล ${suggestion.teacherName} ได้รับการอนุมัติเฉพาะเอกสารนี้` : `คำแนะนำข้อมูลอาจารย์ถูกปฏิเสธ: ${reason}` })
    res.json(suggestion)
  } catch (error) { next(error) }
}
