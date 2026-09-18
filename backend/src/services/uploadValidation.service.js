import {
  findCourseById,
  normalizeDocumentType
} from '../repositories/uploadRequest.repository.js'
import { findTeacher, findOfferingForTeacher, findProgram, inferProgramForCourse, courseValidForContext, courseOfferedInPeriod } from '../repositories/academic.repository.js'
import { academicYear as validateAcademicYear, semester as validateSemester } from './academicValidation.service.js'

export const MAX_FILE_BYTES = 20 * 1024 * 1024

const ALLOWED_FILE_TYPES = new Map([
  ['.pdf', 'application/pdf'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.ppt', 'application/vnd.ms-powerpoint'],
  ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.xls', 'application/vnd.ms-excel'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.txt', 'text/plain'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png']
])

function validationError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  error.expose = true
  return error
}

function validatedFilename(value) {
  const filename = String(value ?? '').trim()
  if (!filename || filename.length > 255 || /[\0\r\n]/.test(filename)) {
    throw validationError('File name is invalid')
  }
  if (filename.includes('/') || filename.includes('\\')) {
    throw validationError('File name must not contain a path')
  }
  return filename
}

export function validateUploadPayload(body) {
  const title = String(body?.title ?? '').trim()
  if (!title || title.length > 200) {
    throw validationError('Document title is required and must be at most 200 characters')
  }
  const fileName = validatedFilename(body?.fileName)
  const extension = fileName.includes('.') ? `.${fileName.split('.').pop().toLowerCase()}` : ''
  const expectedMime = ALLOWED_FILE_TYPES.get(extension)
  const fileType = String(body?.fileType ?? '').trim().toLowerCase()
  if (!expectedMime || fileType !== expectedMime) {
    throw validationError('Unsupported file type or mismatched file extension')
  }
  if (!body?.fileData) throw validationError('File content is required')

  const documentType = normalizeDocumentType(body.documentType)
  if (!documentType) throw validationError('Document type must be Lecture or Sheet')
  const course = findCourseById(String(body.courseId ?? '').trim())
  if (!course) throw validationError('A valid course is required')
  const academicYear = validateAcademicYear(body.academicYear)
  const semester = validateSemester(body.semester)
  const programInput = String(body.programId ?? body.program ?? '').trim()
  const program = programInput ? findProgram(programInput) : inferProgramForCourse(course.id)
  if (programInput && !program) throw validationError('A valid program is required')
  const validContext = program ? courseValidForContext(course.id, program.id, academicYear, semester) : courseOfferedInPeriod(course.id, academicYear, semester)
  if (!validContext) throw validationError('Selected course is not offered for this program, academic year, and semester')
  const description = String(body.description ?? '').trim()
  if (description.length > 1000 || /\0/.test(description)) throw validationError('Description must be at most 1000 characters')
  const submittedTeacherIds = Array.isArray(body.instructorIds) ? body.instructorIds : body.instructorId ? [body.instructorId] : []
  if (submittedTeacherIds.some(id => typeof id !== 'string')) throw validationError('Teacher IDs must be an array of strings')
  const instructorIds = [...new Set(submittedTeacherIds.map(id => id.trim()).filter(Boolean))]
  let courseOfferingId = null
  for (const instructorId of instructorIds) {
    const instructor = findTeacher(instructorId)
    const offering = instructor?.active && findOfferingForTeacher(course.id, academicYear, semester, instructorId, program?.id || '')
    if (!offering) throw validationError('Selected teacher is not assigned to this course, academic year, and semester')
    courseOfferingId ||= offering.id
  }
  const suggestionIds = Array.isArray(body.suggestionIds) ? [...new Set(body.suggestionIds.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))] : []

  return { title, fileName, fileType, documentType, courseId: course.id, instructorIds, courseOfferingId, programId: program?.id || null, academicYear, semester, description, suggestionIds }
}

export function decodeUploadedFile(fileData, fileType) {
  const base64 = String(fileData).replace(/^data:[^;]*;base64,/, '')
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw validationError('Uploaded file content is invalid')
  }
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length === 0) throw validationError('Uploaded file is empty or invalid')
  if (buffer.length > MAX_FILE_BYTES) throw validationError('File is too large (max 20 MB)', 413)

  if (fileType === 'application/pdf' && !buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw validationError('PDF content does not match its file type')
  }
  if (fileType === 'image/png' && !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw validationError('PNG content does not match its file type')
  }
  if (fileType === 'image/jpeg' && !(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)) {
    throw validationError('JPEG content does not match its file type')
  }
  return buffer
}
