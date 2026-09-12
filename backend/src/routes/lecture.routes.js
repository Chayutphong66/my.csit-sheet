import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateIdParam } from '../middleware/validation.middleware.js'
import * as lectureController from '../controllers/lecture.controller.js'

const router = Router()

router.get('/', requireAuth, lectureController.getAllLectures)
router.get('/:id/download', requireAuth, validateIdParam, lectureController.getLectureFile)
router.get('/:id/file', requireAuth, validateIdParam, lectureController.getLectureFile)
router.get('/:id', requireAuth, validateIdParam, lectureController.getLecture)

export default router
