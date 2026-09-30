import { db } from '../data/database.js'

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
    cohort: row.cohort || ''
  }
}

export function findUserByEmailOrUsername(usernameOrEmail) {
  const row = db
    .prepare('SELECT * FROM users WHERE email = ? OR username = ?')
    .get(usernameOrEmail, usernameOrEmail)
  return toUser(row)
}

export function findUserById(id) {
  return toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id))
}

export function createUser(user) {
  db.prepare(`
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

  return findUserById(user.id)
}

export function updateUserPassword(id, password) {
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(password, id)
  return findUserById(id)
}

export function countUsers() {
  return db.prepare('SELECT COUNT(*) AS count FROM users').get().count
}

export function listUsers() {
  return db
    .prepare('SELECT id, username, display_name AS displayName, email, role, program_code AS program, cohort FROM users ORDER BY username')
    .all()
}
