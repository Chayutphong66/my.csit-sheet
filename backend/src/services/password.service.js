import crypto from 'node:crypto'

const KEY_LENGTH = 64
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }
const HASH_PREFIX = 'scrypt'

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url')
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString('base64url')
  return `${HASH_PREFIX}$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt}$${hash}`
}

export function isPasswordHash(value) {
  return typeof value === 'string' && value.startsWith(`${HASH_PREFIX}$`)
}

export function verifyPassword(password, storedPassword) {
  if (!isPasswordHash(storedPassword)) {
    return storedPassword === password
  }

  const [, n, r, p, salt, storedHash] = storedPassword.split('$')
  if (!salt || !storedHash) return false

  const expected = Buffer.from(storedHash, 'base64url')
  const actual = crypto.scryptSync(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT_OPTIONS.maxmem
  })

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}
