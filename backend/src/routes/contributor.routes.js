import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateUsernameParam } from '../middleware/validation.middleware.js'
import * as controller from '../controllers/contributor.controller.js'

const router = Router()
router.use(requireAuth)
router.get('/search', controller.search)
router.get('/:username', validateUsernameParam, controller.profile)

export default router
