import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import { hashPassword } from '../services/password.service.js'
import { calculateContentFingerprint } from '../services/contentFingerprint.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.resolve(__dirname, '../../data')

mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(process.env.DATABASE_PATH || path.join(dataDir, 'csit-sheet.sqlite'))

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
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
    source_request_id TEXT,
    FOREIGN KEY (uploader_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS instructors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS upload_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    lecture_id TEXT,
    sheet_id TEXT,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    file_type TEXT NOT NULL DEFAULT '',
    file_data BLOB,
    course_id TEXT DEFAULT '',
    course_name TEXT DEFAULT '',
    document_type TEXT NOT NULL DEFAULT 'Sheet',
    academic_year TEXT NOT NULL DEFAULT '',
    upload_date TEXT DEFAULT '',
    instructor_id TEXT DEFAULT '',
    instructor_name TEXT DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    rejection_reason TEXT DEFAULT '',
    decided_by TEXT,
    decided_at TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (lecture_id) REFERENCES lectures(id),
    FOREIGN KEY (sheet_id) REFERENCES sheets(id),
    FOREIGN KEY (decided_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'UPLOAD_REQUEST',
    upload_request_id TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (upload_request_id) REFERENCES upload_requests(id)
  );

  CREATE TABLE IF NOT EXISTS lectures (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    instructor TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    academic_year TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    uploader_id TEXT DEFAULT '',
    download_count INTEGER NOT NULL DEFAULT 0,
    file_name TEXT DEFAULT '',
    source_request_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lecture_files (
    id TEXT PRIMARY KEY,
    lecture_id TEXT NOT NULL UNIQUE,
    uploader_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT DEFAULT '',
    mime_type TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    file_data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sheet_files (
    id TEXT PRIMARY KEY,
    sheet_id TEXT NOT NULL UNIQUE,
    uploader_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT DEFAULT '',
    mime_type TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    file_data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sheet_id) REFERENCES sheets(id) ON DELETE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS file_assets (
    id TEXT PRIMARY KEY,
    binary_hash TEXT NOT NULL UNIQUE,
    content_hash TEXT,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    file_data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS document_interactions (
    user_id TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('Lecture', 'Sheet')),
    document_id TEXT NOT NULL,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('VIEW', 'DOWNLOAD')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, document_type, document_id, interaction_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS document_helpful_votes (
    user_id TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('Lecture', 'Sheet')),
    document_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, document_type, document_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
  CREATE INDEX IF NOT EXISTS idx_lecture_files_uploader_id ON lecture_files(uploader_id);
  CREATE INDEX IF NOT EXISTS idx_sheet_files_uploader_id ON sheet_files(uploader_id);
  CREATE INDEX IF NOT EXISTS idx_lectures_status_created ON lectures(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_sheets_status_created ON sheets(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_upload_requests_user_created ON upload_requests(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_file_assets_content_hash ON file_assets(content_hash) WHERE content_hash IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_document_interactions_document ON document_interactions(document_type, document_id, interaction_type);
  CREATE INDEX IF NOT EXISTS idx_document_helpful_document ON document_helpful_votes(document_type, document_id);
`)

const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
if (!userCols.includes('display_name')) db.exec("ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''")
db.exec(`
  UPDATE users SET display_name = username WHERE trim(display_name) = '';
  CREATE INDEX IF NOT EXISTS idx_users_public_identity ON users(lower(username), lower(display_name));
`)

// Idempotent migration: add upload_date to pre-existing databases created before this column existed.
const uploadReqCols = db.prepare('PRAGMA table_info(upload_requests)').all().map((c) => c.name)
if (!uploadReqCols.includes('upload_date')) {
  db.exec("ALTER TABLE upload_requests ADD COLUMN upload_date TEXT DEFAULT ''")
}
if (!uploadReqCols.includes('file_data')) {
  db.exec('ALTER TABLE upload_requests ADD COLUMN file_data BLOB')
}
if (!uploadReqCols.includes('lecture_id')) {
  db.exec('ALTER TABLE upload_requests ADD COLUMN lecture_id TEXT')
}
if (!uploadReqCols.includes('semester')) db.exec("ALTER TABLE upload_requests ADD COLUMN semester TEXT NOT NULL DEFAULT ''")
if (!uploadReqCols.includes('file_hash')) db.exec("ALTER TABLE upload_requests ADD COLUMN file_hash TEXT NOT NULL DEFAULT ''")
if (!uploadReqCols.includes('normalized_title')) db.exec("ALTER TABLE upload_requests ADD COLUMN normalized_title TEXT NOT NULL DEFAULT ''")
if (!uploadReqCols.includes('duplicate_status')) db.exec("ALTER TABLE upload_requests ADD COLUMN duplicate_status TEXT NOT NULL DEFAULT 'NONE'")
if (!uploadReqCols.includes('rejection_type')) db.exec("ALTER TABLE upload_requests ADD COLUMN rejection_type TEXT NOT NULL DEFAULT 'STANDARD'")
if (!uploadReqCols.includes('file_asset_id')) db.exec('ALTER TABLE upload_requests ADD COLUMN file_asset_id TEXT')
if (!uploadReqCols.includes('content_hash')) db.exec("ALTER TABLE upload_requests ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''")

// Idempotent migration: add status to lecture tables created before this column existed.
// Existing rows default to APPROVED so previously-seeded lectures stay visible.
const lectureCols = db.prepare('PRAGMA table_info(lectures)').all().map((c) => c.name)
if (!lectureCols.includes('status')) {
  db.exec("ALTER TABLE lectures ADD COLUMN status TEXT NOT NULL DEFAULT 'APPROVED'")
}

// Idempotent migration: link published sheets/lectures back to the upload request that
// holds the stored file BLOB, and give lectures the uploader/download/file columns they
// need once they can be created from user uploads (not just seeded). Pre-existing rows
// keep NULL/'' and continue to work unchanged.
const sheetCols = db.prepare('PRAGMA table_info(sheets)').all().map((c) => c.name)
if (!sheetCols.includes('source_request_id')) {
  db.exec('ALTER TABLE sheets ADD COLUMN source_request_id TEXT')
}
if (!sheetCols.includes('course_id')) db.exec("ALTER TABLE sheets ADD COLUMN course_id TEXT NOT NULL DEFAULT ''")
if (!sheetCols.includes('academic_year')) db.exec("ALTER TABLE sheets ADD COLUMN academic_year TEXT NOT NULL DEFAULT ''")
if (!sheetCols.includes('semester')) db.exec("ALTER TABLE sheets ADD COLUMN semester TEXT NOT NULL DEFAULT ''")
if (!sheetCols.includes('normalized_title')) db.exec("ALTER TABLE sheets ADD COLUMN normalized_title TEXT NOT NULL DEFAULT ''")
if (!sheetCols.includes('file_hash')) db.exec("ALTER TABLE sheets ADD COLUMN file_hash TEXT NOT NULL DEFAULT ''")
if (!sheetCols.includes('updated_at')) db.exec("ALTER TABLE sheets ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''")
if (!sheetCols.includes('content_hash')) db.exec("ALTER TABLE sheets ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''")
if (!sheetCols.includes('view_count')) db.exec('ALTER TABLE sheets ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0')

const lectureLinkCols = db.prepare('PRAGMA table_info(lectures)').all().map((c) => c.name)
if (!lectureLinkCols.includes('uploader_id')) {
  db.exec("ALTER TABLE lectures ADD COLUMN uploader_id TEXT DEFAULT ''")
}
if (!lectureLinkCols.includes('download_count')) {
  db.exec('ALTER TABLE lectures ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0')
}
if (!lectureLinkCols.includes('file_name')) {
  db.exec("ALTER TABLE lectures ADD COLUMN file_name TEXT DEFAULT ''")
}
if (!lectureLinkCols.includes('source_request_id')) {
  db.exec('ALTER TABLE lectures ADD COLUMN source_request_id TEXT')
}
if (!lectureLinkCols.includes('course_id')) db.exec("ALTER TABLE lectures ADD COLUMN course_id TEXT NOT NULL DEFAULT ''")
if (!lectureLinkCols.includes('semester')) db.exec("ALTER TABLE lectures ADD COLUMN semester TEXT NOT NULL DEFAULT ''")
if (!lectureLinkCols.includes('normalized_title')) db.exec("ALTER TABLE lectures ADD COLUMN normalized_title TEXT NOT NULL DEFAULT ''")
if (!lectureLinkCols.includes('file_hash')) db.exec("ALTER TABLE lectures ADD COLUMN file_hash TEXT NOT NULL DEFAULT ''")
if (!lectureLinkCols.includes('updated_at')) db.exec("ALTER TABLE lectures ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''")
if (!lectureLinkCols.includes('content_hash')) db.exec("ALTER TABLE lectures ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''")
if (!lectureLinkCols.includes('view_count')) db.exec('ALTER TABLE lectures ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0')

const lectureFileCols = db.prepare('PRAGMA table_info(lecture_files)').all().map((c) => c.name)
if (!lectureFileCols.includes('file_asset_id')) db.exec('ALTER TABLE lecture_files ADD COLUMN file_asset_id TEXT')
const sheetFileCols = db.prepare('PRAGMA table_info(sheet_files)').all().map((c) => c.name)
if (!sheetFileCols.includes('file_asset_id')) db.exec('ALTER TABLE sheet_files ADD COLUMN file_asset_id TEXT')

const courseCols = db.prepare('PRAGMA table_info(courses)').all().map((c) => c.name)
if (!courseCols.includes('code')) db.exec("ALTER TABLE courses ADD COLUMN code TEXT NOT NULL DEFAULT ''")
if (!courseCols.includes('description')) db.exec("ALTER TABLE courses ADD COLUMN description TEXT NOT NULL DEFAULT ''")

// Self-healing migration: databases created before the nullable foreign keys were fixed
// stored sheet_id / decided_by / upload_request_id as an empty string (the old column
// DEFAULT '') instead of NULL. SQLite validates any non-NULL foreign key against the
// parent table, and '' matches no row -> "FOREIGN KEY constraint failed". Normalise those
// legacy empty-string values back to NULL so the constraints hold. New rows are already
// inserted with explicit NULLs by the repositories.
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_lectures_source_request
    ON lectures(source_request_id) WHERE source_request_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sheets_source_request
    ON sheets(source_request_id) WHERE source_request_id IS NOT NULL;

  UPDATE upload_requests SET sheet_id = NULL WHERE sheet_id = '';
  UPDATE upload_requests SET lecture_id = NULL WHERE lecture_id = '';
  UPDATE upload_requests
  SET lecture_id = (
    SELECT lectures.id FROM lectures WHERE lectures.source_request_id = upload_requests.id
  )
  WHERE lecture_id IS NULL
    AND EXISTS (SELECT 1 FROM lectures WHERE lectures.source_request_id = upload_requests.id);
  UPDATE upload_requests SET decided_by = NULL WHERE decided_by = '';
  UPDATE notifications SET upload_request_id = NULL WHERE upload_request_id = '';

  UPDATE courses SET code = id WHERE code = '';
  UPDATE upload_requests SET normalized_title = lower(trim(title)) WHERE normalized_title = '';
  UPDATE lectures SET normalized_title = lower(trim(title)) WHERE normalized_title = '';
  UPDATE sheets SET normalized_title = lower(trim(title)) WHERE normalized_title = '';
  UPDATE lectures SET updated_at = created_at WHERE updated_at = '';
  UPDATE sheets SET updated_at = created_at WHERE updated_at = '';
  UPDATE upload_requests
  SET course_id = COALESCE((SELECT id FROM courses WHERE courses.name = upload_requests.course_name OR courses.code = upload_requests.course_name LIMIT 1), course_id)
  WHERE course_id = '' AND course_name != '';
  UPDATE lectures
  SET course_id = COALESCE((SELECT id FROM courses WHERE courses.name = lectures.subject OR courses.code = lectures.subject LIMIT 1), course_id)
  WHERE course_id = '';
  UPDATE sheets
  SET course_id = COALESCE((SELECT id FROM courses WHERE courses.name = sheets.subject OR courses.code = sheets.subject LIMIT 1), course_id)
  WHERE course_id = '';

  CREATE INDEX IF NOT EXISTS idx_upload_requests_hash_status ON upload_requests(file_hash, status);
  CREATE INDEX IF NOT EXISTS idx_upload_requests_content_hash_status ON upload_requests(content_hash, status);
  CREATE INDEX IF NOT EXISTS idx_upload_requests_file_asset ON upload_requests(file_asset_id);
  CREATE INDEX IF NOT EXISTS idx_upload_requests_metadata_duplicate ON upload_requests(course_id, academic_year, semester, document_type, normalized_title, status);
  CREATE INDEX IF NOT EXISTS idx_lectures_hierarchy ON lectures(status, course_id, academic_year, semester);
  CREATE INDEX IF NOT EXISTS idx_sheets_hierarchy ON sheets(status, course_id, academic_year, semester);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_code ON courses(code) WHERE code != '';
  CREATE INDEX IF NOT EXISTS idx_lecture_files_asset ON lecture_files(file_asset_id);
  CREATE INDEX IF NOT EXISTS idx_sheet_files_asset ON sheet_files(file_asset_id);

  CREATE TRIGGER IF NOT EXISTS protect_referenced_file_asset_delete
  BEFORE DELETE ON file_assets
  WHEN EXISTS (SELECT 1 FROM upload_requests WHERE file_asset_id = OLD.id)
    OR EXISTS (SELECT 1 FROM lecture_files WHERE file_asset_id = OLD.id)
    OR EXISTS (SELECT 1 FROM sheet_files WHERE file_asset_id = OLD.id)
  BEGIN
    SELECT RAISE(ABORT, 'file asset is still referenced');
  END;
`)

const unhashedRequests = db.prepare("SELECT id, file_data FROM upload_requests WHERE file_hash = '' AND file_data IS NOT NULL").all()
const backfillRequestHash = db.prepare('UPDATE upload_requests SET file_hash = ? WHERE id = ?')
for (const request of unhashedRequests) {
  backfillRequestHash.run(crypto.createHash('sha256').update(Buffer.from(request.file_data)).digest('hex'), request.id)
}
db.exec(`
  UPDATE lectures SET file_hash = COALESCE((SELECT file_hash FROM upload_requests WHERE id = lectures.source_request_id), '')
  WHERE file_hash = '' AND source_request_id IS NOT NULL;
  UPDATE sheets SET file_hash = COALESCE((SELECT file_hash FROM upload_requests WHERE id = sheets.source_request_id), '')
  WHERE file_hash = '' AND source_request_id IS NOT NULL;
`)

// Move already-published uploaded files into their dedicated public storage tables.
// This preserves existing development data while making lecture_files/sheet_files the
// source of truth for public downloads. Pending/rejected request BLOBs stay untouched.
db.exec(`
  INSERT OR IGNORE INTO lecture_files (
    id, lecture_id, uploader_id, original_filename, stored_filename,
    mime_type, file_size, file_data, created_at, updated_at
  )
  SELECT
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
      substr(lower(hex(randomblob(2))), 2) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
    lectures.id,
    upload_requests.user_id,
    upload_requests.file_name,
    '',
    upload_requests.file_type,
    upload_requests.file_size,
    upload_requests.file_data,
    COALESCE(upload_requests.completed_at, upload_requests.updated_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
  FROM lectures
  JOIN upload_requests ON upload_requests.id = lectures.source_request_id
  WHERE upload_requests.file_data IS NOT NULL
    AND upload_requests.document_type = 'Lecture';

  INSERT OR IGNORE INTO sheet_files (
    id, sheet_id, uploader_id, original_filename, stored_filename,
    mime_type, file_size, file_data, created_at, updated_at
  )
  SELECT
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
      substr(lower(hex(randomblob(2))), 2) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
    sheets.id,
    upload_requests.user_id,
    upload_requests.file_name,
    '',
    upload_requests.file_type,
    upload_requests.file_size,
    upload_requests.file_data,
    COALESCE(upload_requests.completed_at, upload_requests.updated_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
  FROM sheets
  JOIN upload_requests ON upload_requests.id = sheets.source_request_id
  WHERE upload_requests.file_data IS NOT NULL
    AND upload_requests.document_type = 'Sheet';

  UPDATE upload_requests
  SET file_data = NULL
  WHERE file_data IS NOT NULL
    AND status IN ('APPROVED', 'COMPLETED')
    AND (
      EXISTS (
        SELECT 1
        FROM lectures
        JOIN lecture_files ON lecture_files.lecture_id = lectures.id
        WHERE lectures.source_request_id = upload_requests.id
      )
      OR EXISTS (
        SELECT 1
        FROM sheets
        JOIN sheet_files ON sheet_files.sheet_id = sheets.id
        WHERE sheets.source_request_id = upload_requests.id
      )
    );
`)

// Canonicalise every persisted payload into one FileAsset per authoritative SHA-256.
// Domain file rows remain as stable metadata/reference records; their legacy NOT NULL
// BLOB is replaced with an empty value only after the asset reference is committed.
function ensureMigratedAsset({ binaryHash, contentHash = '', fileName, mimeType, fileData }) {
  const buffer = Buffer.from(fileData)
  const hash = binaryHash || crypto.createHash('sha256').update(buffer).digest('hex')
  const fingerprint = contentHash || calculateContentFingerprint(buffer, mimeType)
  db.prepare(`
    INSERT OR IGNORE INTO file_assets (
      id, binary_hash, content_hash, original_filename, mime_type, file_size, file_data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(crypto.randomUUID(), hash, fingerprint || null, fileName || 'document', mimeType || '', buffer.length, buffer)
  if (fingerprint) {
    db.prepare("UPDATE file_assets SET content_hash = COALESCE(NULLIF(content_hash, ''), ?) WHERE binary_hash = ?")
      .run(fingerprint, hash)
  }
  return db.prepare('SELECT id, binary_hash, COALESCE(content_hash, \'\') AS content_hash FROM file_assets WHERE binary_hash = ?').get(hash)
}

db.exec('BEGIN')
try {
  const requestRows = db.prepare(`
    SELECT id, file_name, file_type, file_data, file_hash, content_hash
    FROM upload_requests WHERE file_data IS NOT NULL AND length(file_data) > 0
  `).all()
  const updateRequestAsset = db.prepare(`
    UPDATE upload_requests
    SET file_asset_id = ?, file_hash = ?, content_hash = ?, file_data = NULL
    WHERE id = ?
  `)
  for (const row of requestRows) {
    const asset = ensureMigratedAsset({
      binaryHash: row.file_hash,
      contentHash: row.content_hash,
      fileName: row.file_name,
      mimeType: row.file_type,
      fileData: row.file_data
    })
    updateRequestAsset.run(asset.id, asset.binary_hash, asset.content_hash, row.id)
  }

  const migratePublicFiles = ({ table, idColumn, materialTable }) => {
    const rows = db.prepare(`
      SELECT files.id, files.original_filename, files.mime_type, files.file_data,
             materials.id AS material_id, materials.file_hash, materials.content_hash
      FROM ${table} files
      JOIN ${materialTable} materials ON materials.id = files.${idColumn}
      WHERE files.file_asset_id IS NULL AND length(files.file_data) > 0
    `).all()
    const updateFile = db.prepare(`UPDATE ${table} SET file_asset_id = ?, file_data = X'', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    const updateMaterial = db.prepare(`UPDATE ${materialTable} SET file_hash = ?, content_hash = ? WHERE id = ?`)
    for (const row of rows) {
      const asset = ensureMigratedAsset({
        binaryHash: row.file_hash,
        contentHash: row.content_hash,
        fileName: row.original_filename,
        mimeType: row.mime_type,
        fileData: row.file_data
      })
      updateFile.run(asset.id, row.id)
      updateMaterial.run(asset.binary_hash, asset.content_hash, row.material_id)
    }
  }
  migratePublicFiles({ table: 'lecture_files', idColumn: 'lecture_id', materialTable: 'lectures' })
  migratePublicFiles({ table: 'sheet_files', idColumn: 'sheet_id', materialTable: 'sheets' })

  db.exec(`
    UPDATE upload_requests
    SET file_asset_id = COALESCE(
      (SELECT lecture_files.file_asset_id FROM lectures JOIN lecture_files ON lecture_files.lecture_id = lectures.id
       WHERE lectures.source_request_id = upload_requests.id),
      (SELECT sheet_files.file_asset_id FROM sheets JOIN sheet_files ON sheet_files.sheet_id = sheets.id
       WHERE sheets.source_request_id = upload_requests.id)
    )
    WHERE file_asset_id IS NULL AND status = 'COMPLETED';

    UPDATE upload_requests
    SET content_hash = COALESCE((SELECT content_hash FROM file_assets WHERE id = upload_requests.file_asset_id), content_hash)
    WHERE file_asset_id IS NOT NULL;
  `)
  db.exec('COMMIT')
} catch (error) {
  db.exec('ROLLBACK')
  throw error
}

const shouldSeed = process.env.RUN_DB_SEED === '1' || (
  process.env.SKIP_DB_SEED !== '1' && process.env.NODE_ENV !== 'production'
)

if (shouldSeed) {
const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count

if (userCount === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, display_name, email, password, role, avatar_url, is_verified, provider)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertUser.run('1', 'admin', 'CSIT Admin', 'admin@csitsheet.app', hashPassword('Admin@1234'), 'ADMIN', '', 1, 'local')
  insertUser.run('2', 'student01', 'นักแบ่งปัน CSIT', 'user@csitsheet.app', hashPassword('User@1234'), 'USER', '', 1, 'local')
  insertUser.run('3', 'student02', 'เพื่อนร่วมชั้น', 's2@nu.ac.th', hashPassword('User@1234'), 'USER', '', 1, 'local')
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

const courseCount = db.prepare('SELECT COUNT(*) AS count FROM courses').get().count

if (courseCount === 0) {
  const insertCourse = db.prepare('INSERT INTO courses (id, name, code, description) VALUES (?, ?, ?, ?)')
  ;[
    ['Algorithm', 'CS201', 'Algorithm design and analysis'],
    ['Database', 'CS230', 'Database systems and data modelling'],
    ['Operating System', 'CS250', 'Operating system concepts'],
    ['Computer Network', 'CS260', 'Computer networking'],
    ['Software Engineering', 'CS270', 'Software engineering practice']
  ].forEach(([name, code, description], index) => insertCourse.run(`c${index + 1}`, name, code, description))
}

const instructorCount = db.prepare('SELECT COUNT(*) AS count FROM instructors').get().count

if (instructorCount === 0) {
  const insertInstructor = db.prepare('INSERT INTO instructors (id, name) VALUES (?, ?)')
  ;['Dr. Somchai', 'Dr. Suda', 'Aj. Narin'].forEach((name, index) =>
    insertInstructor.run(`i${index + 1}`, name)
  )
}

const lectureCount = db.prepare('SELECT COUNT(*) AS count FROM lectures').get().count

if (lectureCount === 0) {
  const insertLecture = db.prepare(`
    INSERT INTO lectures (id, title, subject, instructor, description, academic_year, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  ;[
    ['l1', 'Introduction to Algorithms', 'CS201', 'Dr. Somchai', 'Complexity analysis, Big-O notation, and foundational algorithm design techniques.', '2026', '2026-06-02'],
    ['l2', 'Relational Database Design', 'CS230', 'Dr. Suda', 'ER modelling, normalization, and writing effective SQL queries.', '2026', '2026-06-09'],
    ['l3', 'Operating System Concepts', 'CS250', 'Aj. Narin', 'Processes, threads, scheduling, and memory management fundamentals.', '2026', '2026-06-16'],
    ['l4', 'Computer Networks', 'CS260', 'Dr. Somchai', 'The OSI model, TCP/IP stack, routing, and application-layer protocols.', '2026', '2026-06-23'],
    ['l5', 'Software Engineering Principles', 'CS270', 'Dr. Suda', 'Software development life cycle, requirements gathering, and agile practices.', '2026', '2026-06-30'],
    ['l6', 'Data Structures', 'CS202', 'Aj. Narin', 'Lists, stacks, queues, trees, graphs, and hash tables with practical applications.', '2025', '2025-11-04']
  ].forEach((row) => insertLecture.run(...row))
}
}
