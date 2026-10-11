import { withTransaction, lockAdminAccounts } from '../data/databaseClient.js'
import {
  countActiveAdmins, findAdminUserById, listUsers, updateAccountStatus,
  updateAdminEditableUser
} from '../repositories/user.repository.js'
import { createAdminAudit, listAdminAudits } from '../repositories/adminAudit.repository.js'
import { revokeRefreshSessionsByUserId } from '../repositories/refreshToken.repository.js'
import { normalizeCohort, normalizeProgram } from './communityIdentity.service.js'

function fail(message, status = 400) {
  const error = new Error(message); error.status = status; error.expose = true; throw error
}

function pagination(input, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Number(input.page || 1)
  const limit = Number(input.limit || defaultLimit)
  if (!Number.isInteger(page) || page < 1) fail('page must be a positive integer')
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) fail(`limit must be between 1 and ${maxLimit}`)
  return { page, limit }
}

function paged(result, page, limit) {
  return { items: result.items, pagination: { page, limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / limit)) } }
}

export async function searchUsers(query) {
  const { page, limit } = pagination(query)
  const search = String(query.search || '').trim().slice(0, 100)
  const status = String(query.status || '').trim().toUpperCase()
  if (status && !['ACTIVE', 'DEACTIVATED'].includes(status)) fail('status must be ACTIVE or DEACTIVATED')
  return paged(await listUsers({ search, status, page, limit }), page, limit)
}

export async function getUserDetails(id) {
  const user = await findAdminUserById(id)
  if (!user) fail('User not found', 404)
  const audit = await listAdminAudits({ targetUserId: id, page: 1, limit: 20 })
  return { user, audit: audit.items }
}

function editableFields(body) {
  const allowed = new Set(['displayName', 'bio', 'program', 'cohort', 'profilePublic', 'showProgram', 'showCohort'])
  const keys = Object.keys(body || {})
  const unknown = keys.filter(key => !allowed.has(key))
  if (unknown.length) fail(`Fields cannot be changed: ${unknown.join(', ')}`)
  if (!keys.length) fail('At least one editable field is required')
  const fields = {}
  if ('displayName' in body) {
    if (typeof body.displayName !== 'string' || body.displayName.trim().length < 2 || body.displayName.trim().length > 80) fail('displayName must be between 2 and 80 characters')
    fields.displayName = body.displayName.trim()
  }
  if ('bio' in body) {
    if (typeof body.bio !== 'string' || body.bio.trim().length > 500) fail('bio must be at most 500 characters')
    fields.bio = body.bio.trim()
  }
  if ('program' in body) fields.program = normalizeProgram(body.program, { required: false })
  if ('cohort' in body) fields.cohort = normalizeCohort(body.cohort, { required: false })
  for (const field of ['profilePublic', 'showProgram', 'showCohort']) {
    if (field in body) {
      if (typeof body[field] !== 'boolean') fail(`${field} must be a boolean`)
      fields[field] = body[field]
    }
  }
  return fields
}

export async function editUser({ actorId, targetId, body }) {
  const fields = editableFields(body)
  return withTransaction(async () => {
    const before = await findAdminUserById(targetId)
    if (!before) fail('User not found', 404)
    const changes = {}
    for (const [field, value] of Object.entries(fields)) {
      if (before[field] !== value) changes[field] = { from: before[field], to: value }
    }
    if (!Object.keys(changes).length) return before
    const user = await updateAdminEditableUser(targetId, fields)
    await createAdminAudit({ actorUserId: actorId, targetUserId: targetId, action: 'USER_UPDATED', changes })
    return user
  })
}

export async function changeUserStatus({ actorId, targetId, body }) {
  const keys = Object.keys(body || {})
  if (keys.some(key => !['status', 'reason'].includes(key))) fail('Only status and reason may be changed')
  const status = String(body?.status || '').trim().toUpperCase()
  if (!['ACTIVE', 'DEACTIVATED'].includes(status)) fail('status must be ACTIVE or DEACTIVATED')
  const reason = String(body?.reason || '').trim()
  if (status === 'DEACTIVATED' && (reason.length < 5 || reason.length > 500)) fail('reason must be between 5 and 500 characters')
  if (status === 'DEACTIVATED' && actorId === targetId) fail('Administrators cannot deactivate their own account', 409)

  return withTransaction(async () => {
    await lockAdminAccounts()
    const before = await findAdminUserById(targetId)
    if (!before) fail('User not found', 404)
    if (before.accountStatus === status) return before
    if (status === 'DEACTIVATED' && before.role === 'ADMIN' && await countActiveAdmins() <= 1) {
      fail('The last active administrator cannot be deactivated', 409)
    }
    const user = await updateAccountStatus({ id: targetId, status, actorId, reason })
    if (status === 'DEACTIVATED') await revokeRefreshSessionsByUserId(targetId)
    await createAdminAudit({
      actorUserId: actorId, targetUserId: targetId,
      action: status === 'ACTIVE' ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
      changes: { accountStatus: { from: before.accountStatus, to: status }, ...(reason ? { reason } : {}) }
    })
    return user
  })
}

export async function getAuditLogs(query) {
  const { page, limit } = pagination(query)
  const targetUserId = String(query.targetUserId || '').trim()
  return paged(await listAdminAudits({ targetUserId, page, limit }), page, limit)
}
