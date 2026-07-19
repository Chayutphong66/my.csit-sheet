import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.resolve(__dirname, '../../data')

mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(path.join(dataDir, 'csit-sheet.sqlite'))

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('USER', 'ADMIN')),
    avatar_url TEXT DEFAULT '',
    is_verified INTEGER NOT NULL DEFAULT 1,
    provider TEXT NOT NULL DEFAULT 'local',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sheets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TEXT NOT NULL,
    download_count INTEGER NOT NULL DEFAULT 0,
    uploader_id TEXT NOT NULL,
    reject_reason TEXT DEFAULT '',
    FOREIGN KEY (uploader_id) REFERENCES users(id)
  );
`)

const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count

if (userCount === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, password, role, avatar_url, is_verified, provider)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertUser.run('1', 'admin', 'admin@csitsheet.app', 'Admin@1234', 'ADMIN', '', 1, 'local')
  insertUser.run('2', 'student01', 'user@csitsheet.app', 'User@1234', 'USER', '', 1, 'local')
  insertUser.run('3', 'student02', 's2@nu.ac.th', 'User@1234', 'USER', '', 1, 'local')
}

const sheetCount = db.prepare('SELECT COUNT(*) AS count FROM sheets').get().count

if (sheetCount === 0) {
  const insertSheet = db.prepare(`
    INSERT INTO sheets (id, title, subject, status, created_at, download_count, uploader_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  insertSheet.run('s1', 'Calculus II Summary', 'MATH201', 'APPROVED', '2026-07-01', 42, '2')
  insertSheet.run('s2', 'Data Structures Notes', 'CS301', 'PENDING', '2026-07-10', 0, '2')
  insertSheet.run('s3', 'Physics I Cheat Sheet', 'PHY101', 'REJECTED', '2026-07-12', 0, '2')
  insertSheet.run('s4', 'Linear Algebra Review', 'MATH302', 'PENDING', '2026-07-15', 0, '3')
}
