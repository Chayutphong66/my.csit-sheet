import { Router } from 'express'
import * as authController from '../controllers/auth.controller.js'
import { createRateLimiter } from '../middleware/security.middleware.js'
import { validateLogin, validateRefreshCookie, validateRegister } from '../middleware/validation.middleware.js'

const router = Router()
const authRateLimit = createRateLimiter({ max: process.env.NODE_ENV === 'test' ? 1000 : 30, keyPrefix: 'auth' })

router.post('/login', authRateLimit, validateLogin, authController.login)
router.post('/register', authRateLimit, validateRegister, authController.register)
router.post('/refresh', authRateLimit, validateRefreshCookie, authController.refresh)
router.post('/logout', validateRefreshCookie, authController.logout)

export default router
