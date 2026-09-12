import {
  findCourseById,
  findInstructorById,
  normalizeDocumentType
} from '../repositories/uploadRequest.repository.js'

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
  const instructor = findInstructorById(String(body.instructorId ?? '').trim())
  if (!instructor) throw validationError('A valid instructor is required')
  const academicYear = String(body.academicYear ?? '').trim()
  if (!/^\d{4}$/.test(academicYear)) {
    throw validationError('Academic year must be a four-digit year')
  }
  const semester = String(body.semester ?? '').trim()
  if (!semester || semester.length > 30 || /[\0\r\n]/.test(semester)) {
    throw validationError('Semester is required and must be at most 30 characters')
  }

  return { title, fileName, fileType, documentType, courseId: course.id, instructorId: instructor.id, academicYear, semester }
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
