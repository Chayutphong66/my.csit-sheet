import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateIdParam } from '../middleware/validation.middleware.js'
import * as controller from '../controllers/document.controller.js'

export const courseRouter = Router()
courseRouter.use(requireAuth)
courseRouter.get('/', controller.getCourses)
courseRouter.get('/:id/years', validateIdParam, controller.getCourseYears)
courseRouter.get('/:id/years/:year', validateIdParam, controller.getCourseYear)

export const documentRouter = Router()
documentRouter.use(requireAuth)
documentRouter.get('/search', controller.search)
documentRouter.get('/:type/:id/view', validateIdParam, controller.viewDocument)
documentRouter.get('/:type/:id/download', validateIdParam, controller.downloadDocument)
documentRouter.get('/:type/:id', validateIdParam, controller.getDocument)
