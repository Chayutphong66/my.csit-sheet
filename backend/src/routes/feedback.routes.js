import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import { createRateLimiter } from '../middleware/security.middleware.js'
import * as feedbackController from '../controllers/feedback.controller.js'

const router = Router()
export const feedbackSubmissionRateLimit = createRateLimiter({ max: 10, keyPrefix: 'feedback-submit' })

router.use(requireAuth, requireRole('USER'))
router.post('/', feedbackSubmissionRateLimit, feedbackController.submit)
router.get('/me', feedbackController.listMine)
router.get('/:reference', feedbackController.getMine)

export default router
