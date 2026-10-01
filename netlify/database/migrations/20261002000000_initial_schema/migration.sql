CREATE TABLE users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('USER','ADMIN')), avatar_url TEXT DEFAULT '',
  is_verified INTEGER NOT NULL DEFAULT 1, provider TEXT NOT NULL DEFAULT 'local',
  program_code TEXT NOT NULL DEFAULT '' CHECK (program_code IN ('','CS','IT')),
  cohort TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE programs (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE CHECK (code IN ('CS','IT')),
  name_th TEXT NOT NULL, name_en TEXT NOT NULL
);

CREATE TABLE courses (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '', name_th TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '', credits INTEGER, category TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE instructors (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, email TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1, normalized_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE program_courses (
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (program_id, course_id)
);

CREATE TABLE course_offerings (
  id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id),
  academic_year TEXT NOT NULL, semester TEXT NOT NULL CHECK (semester IN ('1','2','3')),
  section TEXT NOT NULL DEFAULT '', source_course_code TEXT NOT NULL DEFAULT '',
  source_course_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  UNIQUE (course_id, academic_year, semester, section)
);

CREATE TABLE course_offering_teachers (
  offering_id TEXT NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES instructors(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  PRIMARY KEY (offering_id, teacher_id)
);

CREATE TABLE course_offering_programs (
  offering_id TEXT NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  PRIMARY KEY (offering_id, program_id)
);

CREATE TABLE sheets (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, subject TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  download_count INTEGER NOT NULL DEFAULT 0, view_count INTEGER NOT NULL DEFAULT 0,
  uploader_id TEXT NOT NULL REFERENCES users(id), reject_reason TEXT DEFAULT '', source_request_id TEXT,
  course_id TEXT NOT NULL DEFAULT '', academic_year TEXT NOT NULL DEFAULT '', semester TEXT NOT NULL DEFAULT '',
  normalized_title TEXT NOT NULL DEFAULT '', file_hash TEXT NOT NULL DEFAULT '', content_hash TEXT NOT NULL DEFAULT '',
  instructor_id TEXT, course_offering_id TEXT, program_id TEXT, current_version_id TEXT
);

CREATE TABLE lectures (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, subject TEXT NOT NULL,
  instructor TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', academic_year TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  uploader_id TEXT DEFAULT '', download_count INTEGER NOT NULL DEFAULT 0, view_count INTEGER NOT NULL DEFAULT 0,
  file_name TEXT DEFAULT '', source_request_id TEXT, course_id TEXT NOT NULL DEFAULT '', semester TEXT NOT NULL DEFAULT '',
  normalized_title TEXT NOT NULL DEFAULT '', file_hash TEXT NOT NULL DEFAULT '', content_hash TEXT NOT NULL DEFAULT '',
  instructor_id TEXT, course_offering_id TEXT, program_id TEXT, current_version_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE file_assets (
  id TEXT PRIMARY KEY, binary_hash TEXT NOT NULL UNIQUE, content_hash TEXT,
  original_filename TEXT NOT NULL, mime_type TEXT NOT NULL DEFAULT '', file_size INTEGER NOT NULL DEFAULT 0,
  file_data BYTEA, blob_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE upload_requests (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  lecture_id TEXT REFERENCES lectures(id), sheet_id TEXT REFERENCES sheets(id),
  title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', program_id TEXT,
  file_name TEXT NOT NULL, file_size INTEGER NOT NULL DEFAULT 0, file_type TEXT NOT NULL DEFAULT '', file_data BYTEA,
  file_asset_id TEXT REFERENCES file_assets(id), course_id TEXT DEFAULT '', course_name TEXT DEFAULT '',
  document_type TEXT NOT NULL DEFAULT 'Sheet', academic_year TEXT NOT NULL DEFAULT '', semester TEXT NOT NULL DEFAULT '',
  upload_date TEXT DEFAULT '', instructor_id TEXT DEFAULT '', instructor_name TEXT DEFAULT '', course_offering_id TEXT,
  file_hash TEXT NOT NULL DEFAULT '', content_hash TEXT NOT NULL DEFAULT '', normalized_title TEXT NOT NULL DEFAULT '',
  duplicate_status TEXT NOT NULL DEFAULT 'NONE', rejection_type TEXT NOT NULL DEFAULT 'STANDARD',
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','PROCESSING','COMPLETED','FAILED')),
  rejection_reason TEXT DEFAULT '', decided_by TEXT REFERENCES users(id), decided_at TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text, completed_at TEXT DEFAULT ''
);

CREATE TABLE lecture_files (
  id TEXT PRIMARY KEY, lecture_id TEXT NOT NULL UNIQUE REFERENCES lectures(id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL REFERENCES users(id), original_filename TEXT NOT NULL, stored_filename TEXT DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '', file_size INTEGER NOT NULL DEFAULT 0, file_data BYTEA,
  file_asset_id TEXT REFERENCES file_assets(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE sheet_files (
  id TEXT PRIMARY KEY, sheet_id TEXT NOT NULL UNIQUE REFERENCES sheets(id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL REFERENCES users(id), original_filename TEXT NOT NULL, stored_filename TEXT DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '', file_size INTEGER NOT NULL DEFAULT 0, file_data BYTEA,
  file_asset_id TEXT REFERENCES file_assets(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'UPLOAD_REQUEST', upload_request_id TEXT REFERENCES upload_requests(id),
  is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE teacher_suggestions (
  id TEXT PRIMARY KEY, teacher_name TEXT NOT NULL, normalized_name TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id), academic_year TEXT NOT NULL,
  semester TEXT NOT NULL CHECK (semester IN ('1','2','3')), section TEXT NOT NULL DEFAULT '',
  submitted_by_user_id TEXT NOT NULL REFERENCES users(id), upload_request_id TEXT REFERENCES upload_requests(id),
  existing_teacher_id TEXT REFERENCES instructors(id), suggestion_type TEXT NOT NULL DEFAULT 'NEW_TEACHER',
  note TEXT NOT NULL DEFAULT '', approval_scope TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reviewed_at TEXT, reviewed_by_user_id TEXT REFERENCES users(id), rejection_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE document_versions (
  id TEXT PRIMARY KEY, document_type TEXT NOT NULL CHECK (document_type IN ('Lecture','Sheet')),
  document_id TEXT NOT NULL, version_number INTEGER, submitted_by TEXT NOT NULL REFERENCES users(id),
  revision_type TEXT NOT NULL CHECK (revision_type IN ('INITIAL','ADD_CONTENT','CORRECT_CONTENT','REMOVE_INCORRECT','UPDATE_DOCUMENT','NEW_ACADEMIC_YEAR','OTHER','RESTORE')),
  change_summary TEXT NOT NULL, original_filename TEXT NOT NULL, mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL, sha256 TEXT NOT NULL, file_asset_id TEXT NOT NULL REFERENCES file_assets(id),
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reviewed_by TEXT REFERENCES users(id), reviewed_at TEXT, review_note TEXT NOT NULL DEFAULT '',
  source_version_id TEXT REFERENCES document_versions(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE upload_request_teachers (
  upload_request_id TEXT NOT NULL REFERENCES upload_requests(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES instructors(id), PRIMARY KEY (upload_request_id, teacher_id)
);

CREATE TABLE document_teachers (
  id TEXT PRIMARY KEY, document_type TEXT NOT NULL CHECK (document_type IN ('Lecture','Sheet')),
  document_id TEXT NOT NULL, teacher_id TEXT REFERENCES instructors(id), display_name TEXT NOT NULL,
  source_suggestion_id TEXT REFERENCES teacher_suggestions(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE document_stars (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('Sheet','Lecture')), document_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  PRIMARY KEY (user_id, document_type, document_id)
);

CREATE TABLE document_interactions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('Lecture','Sheet')), document_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('VIEW','DOWNLOAD')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  PRIMARY KEY (user_id, document_type, document_id, interaction_type)
);

CREATE TABLE document_helpful_votes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('Lecture','Sheet')), document_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  PRIMARY KEY (user_id, document_type, document_id)
);

CREATE TABLE course_imports (
  id TEXT PRIMARY KEY, file_name TEXT NOT NULL, file_hash TEXT NOT NULL,
  program_id TEXT NOT NULL REFERENCES programs(id), imported_by_user_id TEXT REFERENCES users(id),
  imported_rows INTEGER NOT NULL DEFAULT 0, skipped_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL CHECK (status IN ('COMPLETED','FAILED')),
  summary_json TEXT NOT NULL DEFAULT '{}', error_message TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE UNIQUE INDEX idx_courses_code ON courses(code) WHERE code != '';
CREATE INDEX idx_users_public_identity ON users(lower(username), lower(display_name));
CREATE INDEX idx_offerings_period ON course_offerings(academic_year, semester, course_id);
CREATE INDEX idx_offering_teachers_teacher ON course_offering_teachers(teacher_id);
CREATE INDEX idx_program_courses_course ON program_courses(course_id);
CREATE INDEX idx_offering_programs_program ON course_offering_programs(program_id, offering_id);
CREATE UNIQUE INDEX idx_teacher_suggestions_pending_unique ON teacher_suggestions(submitted_by_user_id, course_id, academic_year, semester, section, normalized_name) WHERE status='PENDING';
CREATE INDEX idx_suggestions_status ON teacher_suggestions(status, created_at);
CREATE UNIQUE INDEX idx_lectures_source_request ON lectures(source_request_id) WHERE source_request_id IS NOT NULL;
CREATE UNIQUE INDEX idx_sheets_source_request ON sheets(source_request_id) WHERE source_request_id IS NOT NULL;
CREATE INDEX idx_upload_requests_user_created ON upload_requests(user_id, created_at);
CREATE INDEX idx_upload_requests_hash_status ON upload_requests(file_hash, status);
CREATE INDEX idx_upload_requests_content_hash_status ON upload_requests(content_hash, status);
CREATE INDEX idx_upload_requests_file_asset ON upload_requests(file_asset_id);
CREATE INDEX idx_upload_requests_metadata_duplicate ON upload_requests(course_id, academic_year, semester, document_type, normalized_title, status);
CREATE INDEX idx_lectures_hierarchy ON lectures(status, course_id, academic_year, semester);
CREATE INDEX idx_sheets_hierarchy ON sheets(status, course_id, academic_year, semester);
CREATE INDEX idx_lecture_files_asset ON lecture_files(file_asset_id);
CREATE INDEX idx_sheet_files_asset ON sheet_files(file_asset_id);
CREATE INDEX idx_file_assets_content_hash ON file_assets(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX idx_document_versions_document ON document_versions(document_type, document_id, created_at DESC);
CREATE INDEX idx_document_versions_status ON document_versions(status, created_at);
CREATE INDEX idx_document_versions_submitter ON document_versions(submitted_by, created_at DESC);
CREATE INDEX idx_document_versions_sha256 ON document_versions(sha256);
CREATE UNIQUE INDEX idx_document_versions_approved_number ON document_versions(document_type, document_id, version_number) WHERE status='APPROVED' AND version_number IS NOT NULL;
CREATE UNIQUE INDEX idx_document_teachers_verified ON document_teachers(document_type, document_id, teacher_id) WHERE teacher_id IS NOT NULL;
CREATE UNIQUE INDEX idx_document_teachers_suggestion ON document_teachers(source_suggestion_id) WHERE source_suggestion_id IS NOT NULL;
CREATE INDEX idx_document_stars_document ON document_stars(document_type, document_id);
CREATE INDEX idx_document_interactions_document ON document_interactions(document_type, document_id, interaction_type);
CREATE INDEX idx_document_helpful_document ON document_helpful_votes(document_type, document_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_course_imports_date ON course_imports(imported_at DESC);

INSERT INTO programs (id, code, name_th, name_en) VALUES
  ('program-cs','CS','วิทยาการคอมพิวเตอร์','Computer Science'),
  ('program-it','IT','เทคโนโลยีสารสนเทศ','Information Technology');
