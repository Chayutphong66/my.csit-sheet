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
    showCohort: Boolean(row.show_cohort)
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

export async function listUsers() {
  return await db
    .prepare('SELECT id, username, display_name AS displayName, email, role, program_code AS program, cohort FROM users ORDER BY username')
    .all()
}
