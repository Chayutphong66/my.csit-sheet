import { db } from '../data/database.js'

function toUser(row) {
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    password: row.password,
    role: row.role,
    avatarUrl: row.avatar_url,
    isVerified: Boolean(row.is_verified),
    provider: row.provider
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
    INSERT INTO users (id, username, email, password, role, avatar_url, is_verified, provider)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.username,
    user.email,
    user.password,
    user.role,
    user.avatarUrl ?? '',
    user.isVerified ? 1 : 0,
    user.provider ?? 'local'
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
    .prepare('SELECT id, username, email, role FROM users ORDER BY username')
    .all()
}
