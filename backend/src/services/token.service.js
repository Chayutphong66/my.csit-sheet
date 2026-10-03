import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import {
  createRefreshSession,
  findRefreshSessionByHash,
  revokeExpiredRefreshSessions,
  revokeRefreshSessionByHash
} from '../repositories/refreshToken.repository.js'

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT)
const configuredJwtSecret = process.env.JWT_SECRET?.trim()

if (isProduction && !configuredJwtSecret) {
  throw new Error('JWT_SECRET must be configured in production')
}

const jwtSecret = configuredJwtSecret || 'development-only-jwt-secret'
const accessTokenTtl = process.env.ACCESS_TOKEN_TTL || '15m'
const configuredRefreshTokenTtlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7)
const refreshTokenTtlDays = Number.isFinite(configuredRefreshTokenTtlDays) && configuredRefreshTokenTtlDays > 0
  ? configuredRefreshTokenTtlDays
  : 7

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('base64url')
}

function refreshTokenExpiry() {
  const date = new Date()
  date.setDate(date.getDate() + refreshTokenTtlDays)
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function isExpired(expiresAt) {
  return new Date(`${expiresAt.replace(' ', 'T')}Z`).getTime() <= Date.now()
}

export function createAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    jwtSecret,
    {
      expiresIn: accessTokenTtl,
      issuer: 'csit-sheet-api',
      audience: 'csit-sheet-client'
    }
  )
}

export async function createRefreshToken(user) {
  await revokeExpiredRefreshSessions()

  const token = crypto.randomBytes(64).toString('base64url')
  await createRefreshSession({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: refreshTokenExpiry()
  })
  return token
}

export async function consumeRefreshToken(token) {
  if (!token || typeof token !== 'string') return null

  const tokenHash = hashToken(token)
  const session = await findRefreshSessionByHash(tokenHash)
  if (!session || session.revokedAt || isExpired(session.expiresAt)) {
    if (session && !session.revokedAt) await revokeRefreshSessionByHash(tokenHash)
    return null
  }

  await revokeRefreshSessionByHash(tokenHash)
  return {
    userId: session.userId,
    refreshToken: await createRefreshToken({ id: session.userId })
  }
}

export async function revokeRefreshToken(token) {
  if (!token || typeof token !== 'string') return
  await revokeRefreshSessionByHash(hashToken(token))
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
