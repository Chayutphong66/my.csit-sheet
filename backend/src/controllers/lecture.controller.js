import {
  findApprovedLectures,
  findLectureById
} from '../repositories/lecture.repository.js'
import { findLectureFileByLectureId } from '../repositories/lectureFile.repository.js'
import { recordDocumentInteraction } from '../repositories/communityInteraction.repository.js'
import { findCurrentDocumentVersion, findVersionFile } from '../repositories/documentVersion.repository.js'

// Strip internal linkage fields before returning a lecture to the client, and expose a
// simple `hasFile` flag so the UI knows whether to show a download button. Seeded demo
// lectures have no source_request_id and therefore no downloadable file.
function publicLecture(lecture) {
  const { uploaderId, sourceRequestId, ...safeLecture } = lecture
  return { ...safeLecture, documentType: 'Lecture', hasFile: Boolean(lecture.hasFile) }
}

export async function getAllLectures(_req, res) {
  res.json((await findApprovedLectures()).map(publicLecture))
}

export async function getLecture(req, res, next) {
  try {
    const lecture = await findLectureById(req.params.id)
    if (!lecture) {
      const error = new Error('Lecture not found')
      error.status = 404
      throw error
    }
    res.json(publicLecture(lecture))
  } catch (error) {
    next(error)
  }
}

// Public download for an approved lecture. Published bytes live in lecture_files, so any
// authenticated user can download an approved lecture without accessing the private request.
export async function getLectureFile(req, res, next) {
  try {
    const lecture = await findLectureById(req.params.id)
    if (!lecture || lecture.status !== 'APPROVED') {
      const error = new Error('Lecture not found')
      error.status = 404
      throw error
    }

    const currentVersion = await findCurrentDocumentVersion('Lecture', lecture.id)
    const file = currentVersion ? await findVersionFile(currentVersion.id) : await findLectureFileByLectureId(lecture.id)
    if (!file || !file.fileData) {
      const error = new Error('No file is stored for this lecture')
      error.status = 404
      throw error
    }

    await recordDocumentInteraction({
      userId: req.user.id,
      document: { id: lecture.id, documentType: 'Lecture', uploaderId: lecture.uploaderId },
      interactionType: 'DOWNLOAD'
    })

    const buffer = Buffer.from(file.fileData)
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.originalFilename || lecture.title || 'download')}`
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}
