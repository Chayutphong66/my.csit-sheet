import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { create, putChunk } from '../controllers/uploadSession.controller.js'

const router = Router()
router.use(requireAuth)
router.post('/', create)
router.put('/:id/chunks/:index', putChunk)
export default router
