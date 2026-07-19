import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import * as adminController from '../controllers/admin.controller.js'

const router = Router()

router.use(requireAuth, requireRole('ADMIN'))
router.get('/sheets/pending', adminController.getPendingSheets)
router.patch('/sheets/:id/approve', adminController.approveSheet)
router.patch('/sheets/:id/reject', adminController.rejectSheet)
router.get('/stats', adminController.getStats)

export default router
