import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config, validateAuthentication } from '../config/environment.js'
import { withTransaction } from '../data/databaseClient.js'
import {
  createRefreshSession,
  findRefreshSessionByHash,
  revokeExpiredRefreshSessions,
  revokeRefreshSessionByHash
} from '../repositories/refreshToken.repository.js'

validateAuthentication()
const jwtSecret = config.jwtSecret || 'development-only-jwt-secret'
const accessTokenTtl = config.accessTokenTtl
const refreshTokenTtlDays = config.refreshDays

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('base64url')
}

function refreshTokenExpiry() {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + refreshTokenTtlDays)
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function isExpired(expiresAt) {
  const normalized = String(expiresAt || '').replace(' ', 'T')
  const value = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(normalized) ? normalized : `${normalized}Z`
  const expiry = new Date(value).getTime()
  return !Number.isFinite(expiry) || expiry <= Date.now()
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
  return withTransaction(async () => {
    const tokenHash = hashToken(token)
    const session = await findRefreshSessionByHash(tokenHash)
    if (!session || session.revokedAt || isExpired(session.expiresAt)) {
      if (session && !session.revokedAt) await revokeRefreshSessionByHash(tokenHash)
      return null
    }

    const changed = await revokeRefreshSessionByHash(tokenHash)
    if (!changed.changes) return null
    return {
      userId: session.userId,
      refreshToken: await createRefreshToken({ id: session.userId })
    }
  })
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
