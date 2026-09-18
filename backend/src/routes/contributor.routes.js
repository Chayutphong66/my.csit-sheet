import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateUsernameParam } from '../middleware/validation.middleware.js'
import * as controller from '../controllers/contributor.controller.js'

const router = Router()
router.use(requireAuth)
router.get('/search', controller.search)
router.patch('/me', controller.edit)
router.put('/stars/:type/:id', controller.star)
router.get('/:username', validateUsernameParam, controller.profile)

export default router
