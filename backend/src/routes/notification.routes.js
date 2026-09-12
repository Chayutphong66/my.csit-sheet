import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import { validateIdParam } from '../middleware/validation.middleware.js'
import * as sheetController from '../controllers/sheet.controller.js'

const router = Router()

router.use(requireAuth, requireRole('USER'))
router.get('/', sheetController.getNotifications)
router.patch('/:id/read', validateIdParam, sheetController.readNotification)

export default router
