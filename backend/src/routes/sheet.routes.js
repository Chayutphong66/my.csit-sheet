import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import * as sheetController from '../controllers/sheet.controller.js'

const router = Router()

router.get('/mine', requireAuth, requireRole('USER'), sheetController.getMySheets)

export default router
