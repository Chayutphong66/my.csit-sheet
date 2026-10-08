import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateUsernameParam } from '../middleware/validation.middleware.js'
import * as controller from '../controllers/contributor.controller.js'

const router = Router()
router.get('/:username/avatar', validateUsernameParam, controller.avatar)
router.use(requireAuth)
router.get('/search', controller.search)
router.get('/feed/following', controller.feed)
router.get('/me/settings', controller.settings)
router.patch('/me/settings', controller.saveSettings)
router.post('/me/avatar', controller.uploadAvatar)
router.delete('/me/avatar', controller.removeAvatar)
router.get('/me/change-requests', controller.myChangeRequests)
router.post('/me/change-requests', controller.requestProfileChange)
router.patch('/me', controller.edit)
router.put('/stars/:type/:id', controller.star)
router.put('/:username/follow', validateUsernameParam, controller.follow)
router.get('/:username/followers', validateUsernameParam, controller.followers)
router.get('/:username/following', validateUsernameParam, controller.following)
router.get('/:username', validateUsernameParam, controller.profile)

export default router
