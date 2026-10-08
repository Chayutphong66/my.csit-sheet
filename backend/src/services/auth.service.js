import crypto from 'node:crypto'
import {
  createUser,
  countAdmins,
  findUserByEmail,
  findUserByEmailOrUsername,
  findUserById as findUserRecordById,
  markEmailVerified,
  updateUserPassword
} from '../repositories/user.repository.js'
import { hashPassword, isPasswordHash, verifyPassword } from './password.service.js'
import {
  createAccessToken,
  createRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken
} from './token.service.js'
import { revokeRefreshSessionsByUserId } from '../repositories/refreshToken.repository.js'
import { consumeAccountToken, issueAccountToken } from '../repositories/accountToken.repository.js'
import { sendEmail } from './email.service.js'
import { config } from '../config/environment.js'

function publicUser(user) {
  const { password, avatarStorageKey, ...safeUser } = user
  return safeUser
}

export async function login({ usernameOrEmail, password }) {
  const user = await findUserByEmailOrUsername(usernameOrEmail)
  if (!user || !verifyPassword(password, user.password)) {
    const error = new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    error.status = 401
    throw error
  }

  if (config.emailVerificationEnforced && !user.isVerified) {
    const error = new Error('Please verify your email before signing in')
    error.status = 403
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
    isVerified: false,
    provider: 'local',
    program,
    cohort
  })

  const delivery = await sendVerification(await findUserByEmail(email))
  return {
    message: delivery.status === 'SENT'
      ? 'Account created. Please check your email to verify your address.'
      : delivery.status === 'MOCKED'
        ? 'Account created. Email delivery was simulated in this environment.'
        : 'Account created, but the verification email could not be delivered. Please retry later.',
    emailDelivery: delivery.status
  }
}

async function sendVerification(user) {
  if (!user || user.isVerified) return { status: 'NOT_REQUIRED' }
  const issued = await issueAccountToken(user.id, 'EMAIL_VERIFICATION', config.verificationTokenMinutes)
  return sendEmail({ userId: user.id, to: user.email, template: 'emailVerification', data: { displayName: user.displayName, url: `${config.appBaseUrl}/verify-email?token=${encodeURIComponent(issued.token)}` } })
}

export async function verifyEmail(token) {
  const user = await consumeAccountToken(token, 'EMAIL_VERIFICATION', markEmailVerified)
  if (!user) { const error = new Error('Verification link is invalid, expired, or already used'); error.status = 400; throw error }
  return { message: 'Email verified successfully. You can now sign in.' }
}

export async function resendVerification(email) {
  const user = await findUserByEmail(email)
  if (user && !user.isVerified) await sendVerification(user)
  return { message: 'If the account exists and still needs verification, an email will be sent.' }
}

export async function forgotPassword(email) {
  const user = await findUserByEmail(email)
  if (user) {
    const issued = await issueAccountToken(user.id, 'PASSWORD_RESET', config.passwordResetTokenMinutes)
    await sendEmail({ userId: user.id, to: user.email, template: 'passwordReset', data: { displayName: user.displayName, minutes: config.passwordResetTokenMinutes, url: `${config.appBaseUrl}/reset-password?token=${encodeURIComponent(issued.token)}` } })
  }
  return { message: 'If an account matches that email, password reset instructions will be sent.' }
}

export async function resetPassword({ token, password }) {
  const user = await consumeAccountToken(token, 'PASSWORD_RESET', async userId => {
    await updateUserPassword(userId, hashPassword(password))
    await revokeRefreshSessionsByUserId(userId)
    return findUserRecordById(userId)
  })
  if (!user) { const error = new Error('Reset link is invalid, expired, or already used'); error.status = 400; throw error }
  await sendEmail({ userId: user.id, to: user.email, template: 'passwordChanged', data: { displayName: user.displayName } })
  return { message: 'Password updated. Please sign in with your new password.' }
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
