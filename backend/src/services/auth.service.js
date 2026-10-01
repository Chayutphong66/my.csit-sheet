import crypto from 'node:crypto'
import {
  createUser,
  countAdmins,
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

export async function login({ usernameOrEmail, password }) {
  const user = await findUserByEmailOrUsername(usernameOrEmail)
  if (!user || !verifyPassword(password, user.password)) {
    const error = new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    error.status = 401
    throw error
  }

  if (!isPasswordHash(user.password)) {
    await updateUserPassword(user.id, hashPassword(password))
  }

  return {
    user: publicUser(user),
    accessToken: createAccessToken(user),
    refreshToken: await createRefreshToken(user)
  }
}

export async function register({ username, displayName, email, password, program, cohort }) {
  if (await findUserByEmailOrUsername(email) || await findUserByEmailOrUsername(username)) {
    const error = new Error('อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว')
    error.status = 409
    throw error
  }

  const bootstrapAdminEmail = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase()
  const role = bootstrapAdminEmail && email.toLowerCase() === bootstrapAdminEmail && await countAdmins() === 0
    ? 'ADMIN'
    : 'USER'
  await createUser({
    id: crypto.randomUUID(),
    username,
    displayName,
    email,
    password: hashPassword(password),
    role,
    avatarUrl: '',
    isVerified: true,
    provider: 'local',
    program,
    cohort
  })

  return { message: 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ' }
}

export async function refresh(refreshToken) {
  const session = await consumeRefreshToken(refreshToken)
  if (!session) return null

  const user = await findUserRecordById(session.userId)
  if (!user) return null

  return {
    user: publicUser(user),
    accessToken: createAccessToken(user),
    refreshToken: session.refreshToken
  }
}

export async function logout(refreshToken) {
  if (refreshToken) await revokeRefreshToken(refreshToken)
}

export async function findUserById(id) {
  const user = await findUserRecordById(id)
  return user ? publicUser(user) : null
}
