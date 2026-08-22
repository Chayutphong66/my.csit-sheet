import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

const jwtSecret = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me'
const refreshTokens = new Map()

export function createAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    jwtSecret,
    {
      expiresIn: '15m',
      issuer: 'csit-sheet-api',
      audience: 'csit-sheet-client'
    }
  )
}

export function createRefreshToken(user) {
  const token = crypto.randomUUID()
  refreshTokens.set(token, user.id)
  return token
}

export function getUserIdByRefreshToken(token) {
  return refreshTokens.get(token)
}

export function revokeRefreshToken(token) {
  refreshTokens.delete(token)
}

export function parseAccessToken(token) {
  try {
    return jwt.verify(token, jwtSecret, {
      issuer: 'csit-sheet-api',
      audience: 'csit-sheet-client'
    })
  } catch {
    return null
  }
}
