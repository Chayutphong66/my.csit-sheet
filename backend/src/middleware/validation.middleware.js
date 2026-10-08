import { normalizeCohort, normalizeProgram } from '../services/communityIdentity.service.js'

function validationError(message) {
  const error = new Error(message)
  error.status = 400
  error.expose = true
  return error
}

function requireString(value, field, { min = 1, max = 255 } = {}) {
  if (typeof value !== 'string') throw validationError(`${field} is required`)
  const trimmed = value.trim()
  if (trimmed.length < min) throw validationError(`${field} is too short`)
  if (trimmed.length > max) throw validationError(`${field} is too long`)
  return trimmed
}

export function validateLogin(req, _res, next) {
  try {
    req.body = {
      usernameOrEmail: requireString(req.body?.usernameOrEmail, 'usernameOrEmail', { max: 255 }),
      password: requireString(req.body?.password, 'password', { min: 1, max: 1024 })
    }
    next()
  } catch (error) {
    next(error)
  }
}

export function validateRegister(req, _res, next) {
  try {
    const username = requireString(req.body?.username, 'username', { min: 3, max: 50 })
    const displayName = req.body?.displayName === undefined
      ? username
      : requireString(req.body.displayName, 'displayName', { min: 2, max: 80 })
    const email = requireString(req.body?.email, 'email', { max: 255 }).toLowerCase()
    const password = requireString(req.body?.password, 'password', { min: 8, max: 1024 })
    const confirmPassword = req.body?.confirmPassword === undefined
      ? password
      : requireString(req.body.confirmPassword, 'confirmPassword', { min: 8, max: 1024 })
    const program = normalizeProgram(req.body?.program)
    const cohort = normalizeCohort(req.body?.cohort)

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      throw validationError('username contains invalid characters')
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw validationError('email is invalid')
    }
    if (password !== confirmPassword) throw validationError('Passwords do not match')

    req.body = { username, displayName, email, password, program, cohort }
    next()
  } catch (error) {
    next(error)
  }
}

export function validateEmailBody(req, _res, next) {
  try {
    const email = requireString(req.body?.email, 'email', { max: 255 }).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw validationError('email is invalid')
    req.body = { email }; next()
  } catch (error) { next(error) }
}

export function validateResetPassword(req, _res, next) {
  try {
    const token = requireString(req.body?.token, 'token', { min: 20, max: 512 })
    const password = requireString(req.body?.password, 'password', { min: 8, max: 1024 })
    const confirmPassword = requireString(req.body?.confirmPassword, 'confirmPassword', { min: 8, max: 1024 })
    if (password !== confirmPassword) throw validationError('Passwords do not match')
    req.body = { token, password }; next()
  } catch (error) { next(error) }
}

export function validateRefreshCookie(req, _res, next) {
  try {
    const token = req.cookies?.refreshToken
    if (token !== undefined && (typeof token !== 'string' || token.length > 512)) {
      throw validationError('refresh token is invalid')
    }
    next()
  } catch (error) {
    next(error)
  }
}

export function validateIdParam(req, _res, next) {
  const id = String(req.params.id ?? '')
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
    next(validationError('Invalid resource ID'))
    return
  }
  next()
}

export function validateIdParams(...names) {
  return (req, _res, next) => {
    for (const name of names) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(String(req.params[name] ?? ''))) {
        next(validationError(`Invalid ${name}`))
        return
      }
    }
    next()
  }
}

export function validateUsernameParam(req, _res, next) {
  const username = String(req.params.username ?? '')
  if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username)) {
    next(validationError('Invalid username'))
    return
  }
  next()
}
