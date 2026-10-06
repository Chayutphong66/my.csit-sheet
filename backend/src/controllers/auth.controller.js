import * as authService from '../services/auth.service.js'
import { logServerError } from '../services/safeLogger.service.js'
import { config } from '../config/environment.js'

const refreshMaxAge = config.refreshDays * 24 * 60 * 60 * 1000

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
    maxAge: refreshMaxAge,
    path: '/api/auth'
  }
}

export async function login(req, res, next) {
  try {
    const data = await authService.login(req.body)
    res.cookie('refreshToken', data.refreshToken, refreshCookieOptions())
    res.json({ user: data.user, accessToken: data.accessToken })
  } catch (error) {
    if ((error.status ?? 500) >= 500) logServerError('auth.login_failed', error, { operation: 'login', requestId: req.requestId })
    next(error)
  }
}

export async function register(req, res, next) {
  try {
    res.status(201).json(await authService.register(req.body))
  } catch (error) {
    if ((error.status ?? 500) >= 500) logServerError('auth.registration_failed', error, { operation: 'register', requestId: req.requestId })
    next(error)
  }
}

export async function refresh(req, res) {
  const data = await authService.refresh(req.cookies.refreshToken)
  if (!data) {
    res.status(401).json({ message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
    return
  }
  res.cookie('refreshToken', data.refreshToken, refreshCookieOptions())
  res.json({ user: data.user, accessToken: data.accessToken })
}

export async function logout(req, res) {
  await authService.logout(req.cookies.refreshToken)
  const { maxAge: _maxAge, ...options } = refreshCookieOptions()
  res.clearCookie('refreshToken', options)
  res.status(204).end()
}
