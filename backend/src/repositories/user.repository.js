import { db } from '../data/databaseClient.js'

function toUser(row) {
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    email: row.email,
    password: row.password,
    role: row.role,
    avatarUrl: row.avatar_url,
    isVerified: Boolean(row.is_verified),
    provider: row.provider,
    program: row.program_code || '',
    cohort: row.cohort || '',
    bio: row.bio || '',
    avatarStorageKey: row.avatar_storage_key || '',
    emailVerifiedAt: row.email_verified_at || null,
    displayNameChangedAt: row.display_name_changed_at || null,
    profilePublic: Boolean(row.profile_public),
    showProgram: Boolean(row.show_program),
    showCohort: Boolean(row.show_cohort),
    accountStatus: row.account_status || 'ACTIVE',
    deactivatedAt: row.deactivated_at || null,
    deactivatedBy: row.deactivated_by || null,
    deactivationReason: row.deactivation_reason || '',
    createdAt: row.created_at || null
  }
}

export async function findUserByEmailOrUsername(usernameOrEmail) {
  const row = await db
    .prepare('SELECT * FROM users WHERE email = ? OR username = ?')
    .get(usernameOrEmail, usernameOrEmail)
  return toUser(row)
}

export async function findUserById(id) {
  return toUser(await db.prepare('SELECT * FROM users WHERE id = ?').get(id))
}

export async function findUserByEmail(email) {
  return toUser(await db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(String(email || '').trim()))
}

export async function createUser(user) {
  try {
    await db.prepare(`
      INSERT INTO users (id, username, display_name, email, password, role, avatar_url, is_verified, provider, program_code, cohort)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.username,
      user.displayName || user.username,
      user.email,
      user.password,
      user.role,
      user.avatarUrl ?? '',
      user.isVerified ? 1 : 0,
      user.provider ?? 'local',
      user.program ?? '',
      user.cohort ?? ''
    )

  } catch (error) {
    if (error.code === '23505' || (error.code === 'ERR_SQLITE_ERROR' && /UNIQUE constraint failed: users\.(?:username|email)/.test(error.message))) {
      const conflict = new Error('Username or email is already registered')
      conflict.status = 409
      throw conflict
    }
    throw error
  }
  return await findUserById(user.id)
}

export async function updateUserPassword(id, password) {
  await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(password, id)
  return await findUserById(id)
}

export async function markEmailVerified(id) {
  await db.prepare('UPDATE users SET is_verified=1,email_verified_at=CURRENT_TIMESTAMP WHERE id=?').run(id)
  return findUserById(id)
}

export async function countUsers() {
  return (await db.prepare('SELECT COUNT(*) AS count FROM users').get()).count
}

export async function countAdmins() {
  return Number((await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN'").get()).count)
}

export async function countActiveAdmins() {
  return Number((await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='ADMIN' AND account_status='ACTIVE'").get()).count)
}

function adminUser(row) {
  if (!row) return null
  return {
    id: row.id, username: row.username, displayName: row.displayName, email: row.email,
    role: row.role, program: row.program || '', cohort: row.cohort || '', bio: row.bio || '',
    profilePublic: Boolean(row.profilePublic), showProgram: Boolean(row.showProgram), showCohort: Boolean(row.showCohort),
    isVerified: Boolean(row.isVerified), provider: row.provider, accountStatus: row.accountStatus || 'ACTIVE',
    deactivatedAt: row.deactivatedAt || null, deactivatedBy: row.deactivatedBy || null,
    deactivationReason: row.deactivationReason || '', createdAt: row.createdAt || null,
    lectureCount: Number(row.lectureCount || 0), sheetCount: Number(row.sheetCount || 0),
    uploadCount: Number(row.uploadCount || 0), contributionCount: Number(row.contributionCount || 0)
  }
}

const adminUserSelect = `
  SELECT u.id, u.username, u.display_name AS displayName, u.email, u.role,
    u.program_code AS program, u.cohort, u.bio, u.profile_public AS profilePublic,
    u.show_program AS showProgram, u.show_cohort AS showCohort, u.is_verified AS isVerified,
    u.provider, u.account_status AS accountStatus, u.deactivated_at AS deactivatedAt,
    u.deactivated_by AS deactivatedBy, u.deactivation_reason AS deactivationReason,
    u.created_at AS createdAt,
    (SELECT COUNT(*) FROM lectures l WHERE l.uploader_id=u.id) AS lectureCount,
    (SELECT COUNT(*) FROM sheets s WHERE s.uploader_id=u.id) AS sheetCount,
    (SELECT COUNT(*) FROM upload_requests r WHERE r.user_id=u.id) AS uploadCount,
    (SELECT COUNT(*) FROM document_versions v WHERE v.submitted_by=u.id) AS contributionCount
  FROM users u`

export async function listUsers({ search = '', status = '', page = 1, limit = 20 } = {}) {
  const clauses = []
  const parameters = []
  if (search) {
    const term = `%${search.toLowerCase()}%`
    clauses.push('(lower(u.username) LIKE ? OR lower(u.display_name) LIKE ? OR lower(u.email) LIKE ?)')
    parameters.push(term, term, term)
  }
  if (status) { clauses.push('u.account_status=?'); parameters.push(status) }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
  const total = Number((await db.prepare(`SELECT COUNT(*) AS count FROM users u${where}`).get(...parameters)).count)
  const rows = await db.prepare(`${adminUserSelect}${where} ORDER BY lower(u.username), u.id LIMIT ? OFFSET ?`)
    .all(...parameters, limit, (page - 1) * limit)
  return { items: rows.map(adminUser), total }
}

export async function findAdminUserById(id) {
  return adminUser(await db.prepare(`${adminUserSelect} WHERE u.id=?`).get(id))
}

export async function updateAdminEditableUser(id, fields) {
  const mapping = {
    displayName: 'display_name', bio: 'bio', program: 'program_code', cohort: 'cohort',
    profilePublic: 'profile_public', showProgram: 'show_program', showCohort: 'show_cohort'
  }
  const entries = Object.entries(fields)
  if (!entries.length) return findAdminUserById(id)
  const set = entries.map(([key]) => `${mapping[key]}=?`).join(', ')
  const values = entries.map(([_key, value]) => typeof value === 'boolean' ? (value ? 1 : 0) : value)
  await db.prepare(`UPDATE users SET ${set} WHERE id=?`).run(...values, id)
  return findAdminUserById(id)
}

export async function updateAccountStatus({ id, status, actorId, reason }) {
  const deactivating = status === 'DEACTIVATED'
  const result = await db.prepare(`UPDATE users SET account_status=?, deactivated_at=${deactivating ? 'CURRENT_TIMESTAMP' : 'NULL'}, deactivated_by=?, deactivation_reason=? WHERE id=?`)
    .run(status, deactivating ? actorId : null, deactivating ? reason : '', id)
  return result.changes ? findAdminUserById(id) : null
}
