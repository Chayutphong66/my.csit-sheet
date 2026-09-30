import crypto from 'node:crypto'
import {
  createUser,
  findUserByEmailOrUsername,
  findUserById as findUserRecordById,
  updateUserPassword
} from '../repositories/user.repository.js'
import { hashPassword, isPasswordHash, verifyPassword } from './password.service.js'
import {
  createAccessToken,
  createRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken
} from './token.service.js'

function publicUser(user) {
  const { password, ...safeUser } = user
  return safeUser
}

export function login({ usernameOrEmail, password }) {
  const user = findUserByEmailOrUsername(usernameOrEmail)
  if (!user || !verifyPassword(password, user.password)) {
    const error = new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    error.status = 401
    throw error
  }

  if (!isPasswordHash(user.password)) {
    updateUserPassword(user.id, hashPassword(password))
  }

  return {
    user: publicUser(user),
    accessToken: createAccessToken(user),
    refreshToken: createRefreshToken(user)
  }
}

export function register({ username, displayName, email, password, program, cohort }) {
  if (findUserByEmailOrUsername(email) || findUserByEmailOrUsername(username)) {
    const error = new Error('อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว')
    error.status = 409
    throw error
  }

  createUser({
    id: crypto.randomUUID(),
    username,
    displayName,
    email,
    password: hashPassword(password),
    role: 'USER',
    avatarUrl: '',
    isVerified: true,
    provider: 'local',
    program,
    cohort
  })

  return { message: 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ' }
}

export function refresh(refreshToken) {
  const session = consumeRefreshToken(refreshToken)
  if (!session) return null

  const user = findUserRecordById(session.userId)
  if (!user) return null

  return {
    user: publicUser(user),
    accessToken: createAccessToken(user),
    refreshToken: session.refreshToken
  }
}

export function logout(refreshToken) {
  if (refreshToken) revokeRefreshToken(refreshToken)
}

export function findUserById(id) {
  const user = findUserRecordById(id)
  return user ? publicUser(user) : null
}
