import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import { validateIdParam } from '../middleware/validation.middleware.js'
import * as controller from '../controllers/academic.controller.js'
const router = Router()
router.use(requireAuth, requireRole('USER'))
router.post('/', controller.suggestTeacher)
export const suggestionRouter = router

export const curriculumRouter = Router()
curriculumRouter.use(requireAuth)
curriculumRouter.get('/programs', controller.programs)
curriculumRouter.get('/', controller.courses)
curriculumRouter.get('/periods', controller.periods)
curriculumRouter.get('/:id/teachers', validateIdParam, controller.courseTeachers)
