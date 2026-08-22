import * as authService from '../services/auth.service.js'

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  maxAge: 7 * 24 * 60 * 60 * 1000
}

export function login(req, res, next) {
  try {
    const data = authService.login(req.body)
    res.cookie('refreshToken', data.refreshToken, cookieOptions)
    res.json({ user: data.user, accessToken: data.accessToken })
  } catch (error) {
    next(error)
  }
}

export function register(req, res, next) {
  try {
    res.status(201).json(authService.register(req.body))
  } catch (error) {
    next(error)
  }
}

export function refresh(req, res) {
  const data = authService.refresh(req.cookies.refreshToken)
  if (!data) {
    res.status(401).json({ message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
    return
  }
  res.json(data)
}

export function logout(req, res) {
  authService.logout(req.cookies.refreshToken)
  res.clearCookie('refreshToken')
  res.status(204).end()
}
