import { findApprovedLectures, findLectureById } from '../repositories/lecture.repository.js'

export function getAllLectures(_req, res) {
  res.json(findApprovedLectures())
}

export function getLecture(req, res, next) {
  try {
    const lecture = findLectureById(req.params.id)
    if (!lecture) {
      const error = new Error('Lecture not found')
      error.status = 404
      throw error
    }
    res.json(lecture)
  } catch (error) {
    next(error)
  }
}
