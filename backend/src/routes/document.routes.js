import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateIdParam, validateIdParams } from '../middleware/validation.middleware.js'
import * as controller from '../controllers/document.controller.js'

export const courseRouter = Router()
courseRouter.use(requireAuth)
courseRouter.get('/', controller.getCourses)
courseRouter.get('/:id/years', validateIdParam, controller.getCourseYears)
courseRouter.get('/:id/years/:year', validateIdParam, controller.getCourseYear)

export const documentRouter = Router()
documentRouter.use(requireAuth)
documentRouter.get('/search', controller.search)
documentRouter.get('/my/revisions', controller.getMyRevisions)
documentRouter.get('/:type/:id/versions', validateIdParam, controller.getVersions)
documentRouter.post('/:type/:id/revisions', requireAuth, validateIdParam, controller.createRevision)
documentRouter.get('/:type/:id/versions/:versionId/view', validateIdParams('id', 'versionId'), controller.viewVersion)
documentRouter.get('/:type/:id/versions/:versionId/download', validateIdParams('id', 'versionId'), controller.downloadVersion)
documentRouter.get('/:type/:id/view', validateIdParam, controller.viewDocument)
documentRouter.get('/:type/:id/download', validateIdParam, controller.downloadDocument)
documentRouter.put('/:type/:id/helpful', validateIdParam, controller.updateHelpful)
documentRouter.get('/:type/:id', validateIdParam, controller.getDocument)
