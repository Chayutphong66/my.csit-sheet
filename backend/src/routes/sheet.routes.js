import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import { validateIdParam } from '../middleware/validation.middleware.js'
import * as sheetController from '../controllers/sheet.controller.js'

const router = Router()

router.get('/recommended', requireAuth, sheetController.getRecommendedSheets)
router.get('/all', requireAuth, sheetController.getAllSheets)
router.get('/mine', requireAuth, requireRole('USER'), sheetController.getMySheets)
router.get('/metadata', requireAuth, sheetController.getMetadata)
router.get('/catalog', requireAuth, sheetController.getCatalog)
router.get('/notifications', requireAuth, requireRole('USER'), sheetController.getNotifications)
router.patch('/notifications/:id/read', requireAuth, requireRole('USER'), validateIdParam, sheetController.readNotification)
router.post('/upload-requests', requireAuth, requireRole('USER'), sheetController.createRequest)
router.get('/upload-requests', requireAuth, requireRole('USER'), sheetController.getMyUploadRequests)
router.get('/upload-requests/:id', requireAuth, requireRole('USER'), validateIdParam, sheetController.getUploadRequest)
router.get('/upload-requests/:id/file', requireAuth, requireRole('USER'), validateIdParam, sheetController.getUploadRequestFile)
router.patch('/upload-requests/:id/complete', requireAuth, requireRole('USER'), validateIdParam, sheetController.completeRequest)

// Public download of an approved sheet's file — placed last so the more specific
// /upload-requests/* routes are matched first and the :id param stays narrow.
router.get('/:id/download', requireAuth, validateIdParam, sheetController.getSheetFile)
router.get('/:id/file', requireAuth, validateIdParam, sheetController.getSheetFile)

export default router
