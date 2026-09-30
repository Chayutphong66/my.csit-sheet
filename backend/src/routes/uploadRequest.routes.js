import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import { validateIdParam } from '../middleware/validation.middleware.js'
import * as sheetController from '../controllers/sheet.controller.js'

const router = Router()

router.use(requireAuth, requireRole('USER'))
router.post('/duplicate-check', sheetController.previewDuplicateRequests)
router.post('/', sheetController.createRequest)
router.get('/', sheetController.getMyUploadRequests)
router.get('/contributions', sheetController.getMyContributions)
router.get('/:id', validateIdParam, sheetController.getUploadRequest)
router.get('/:id/file', validateIdParam, sheetController.getUploadRequestFile)
router.patch('/:id/complete', validateIdParam, sheetController.completeRequest)

export default router
