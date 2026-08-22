import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import * as lectureController from '../controllers/lecture.controller.js'

const router = Router()

router.get('/', requireAuth, lectureController.getAllLectures)
router.get('/:id', requireAuth, lectureController.getLecture)

export default router
