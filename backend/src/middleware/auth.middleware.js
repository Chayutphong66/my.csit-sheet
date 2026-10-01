import { parseAccessToken } from '../services/token.service.js'
import { findUserById } from '../services/auth.service.js'

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const payload = parseAccessToken(token)

  if (!payload) {
    const error = new Error('กรุณาเข้าสู่ระบบ')
    error.status = 401
    next(error)
    return
  }

  const user = await findUserById(payload.sub)
  if (!user) {
    const error = new Error('ไม่พบผู้ใช้')
    error.status = 401
    next(error)
    return
  }

  req.user = user
  next()
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (req.user?.role !== role) {
      const error = new Error('ไม่มีสิทธิ์เข้าถึง')
      error.status = 403
      next(error)
      return
    }
    next()
  }
}
