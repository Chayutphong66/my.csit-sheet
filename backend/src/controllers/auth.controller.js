import * as authService from '../services/auth.service.js'

const refreshMaxAge = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7) * 24 * 60 * 60 * 1000

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    secure: process.env.NODE_ENV === 'production',
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
    next(error)
  }
}

export async function register(req, res, next) {
  try {
    res.status(201).json(await authService.register(req.body))
  } catch (error) {
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
  res.clearCookie('refreshToken', { path: '/api/auth' })
  res.status(204).end()
}
