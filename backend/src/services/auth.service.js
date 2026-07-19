import crypto from 'node:crypto'
import {
  createUser,
  findUserByEmailOrUsername,
  findUserById as findUserRecordById
} from '../repositories/user.repository.js'
import { createAccessToken, createRefreshToken, getUserIdByRefreshToken, revokeRefreshToken } from './token.service.js'

function publicUser(user) {
  const { password, ...safeUser } = user
  return safeUser
}

export function login({ usernameOrEmail, password }) {
  const user = findUserByEmailOrUsername(usernameOrEmail)
  if (!user || user.password !== password) {
    const error = new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    error.status = 401
    throw error
  }

  return {
    user: publicUser(user),
    accessToken: createAccessToken(user),
    refreshToken: createRefreshToken(user)
  }
}

export function register({ username, email, password }) {
  if (findUserByEmailOrUsername(email) || findUserByEmailOrUsername(username)) {
    const error = new Error('อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว')
    error.status = 409
    throw error
  }

  createUser({
    id: crypto.randomUUID(),
    username,
    email,
    password,
    role: 'USER',
    avatarUrl: '',
    isVerified: true,
    provider: 'local'
  })

  return { message: 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ' }
}

export function refresh(refreshToken) {
  const userId = getUserIdByRefreshToken(refreshToken)
  const user = findUserRecordById(userId)
  if (!user) return null

  return {
    user: publicUser(user),
    accessToken: createAccessToken(user)
  }
}

export function logout(refreshToken) {
  if (refreshToken) revokeRefreshToken(refreshToken)
}

export function findUserById(id) {
  const user = findUserRecordById(id)
  return user ? publicUser(user) : null
}
