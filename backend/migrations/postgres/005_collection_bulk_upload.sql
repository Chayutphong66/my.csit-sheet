-- Phase 4: additive collection management and resumable bulk-upload tracking.
-- Static compatibility review: PostgreSQL 14+, no destructive statements.

CREATE TABLE collections (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ARCHIVED')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE collection_documents (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK(document_type IN ('Lecture','Sheet')),
  document_id TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  PRIMARY KEY(collection_id, document_type, document_id)
);

CREATE TABLE bulk_upload_jobs (
  id TEXT PRIMARY KEY, created_by TEXT NOT NULL REFERENCES users(id),
  collection_id TEXT REFERENCES collections(id),
  status TEXT NOT NULL DEFAULT 'PROCESSING' CHECK(status IN ('PROCESSING','COMPLETED','PARTIAL','FAILED')),
  total_items INTEGER NOT NULL DEFAULT 0, succeeded_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE bulk_upload_items (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES bulk_upload_jobs(id) ON DELETE CASCADE,
  client_key TEXT NOT NULL, request_id TEXT REFERENCES upload_requests(id),
  status TEXT NOT NULL CHECK(status IN ('READY','DUPLICATE','FAILED')),
  error_code TEXT NOT NULL DEFAULT '', error_message TEXT NOT NULL DEFAULT '',
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  UNIQUE(job_id, client_key)
);

ALTER TABLE upload_requests ADD COLUMN IF NOT EXISTS collection_id TEXT REFERENCES collections(id);

CREATE INDEX idx_collection_documents_document ON collection_documents(document_type, document_id);
CREATE INDEX idx_bulk_upload_jobs_creator ON bulk_upload_jobs(created_by, created_at DESC);
CREATE INDEX idx_bulk_upload_items_job ON bulk_upload_items(job_id, created_at);
CREATE INDEX idx_upload_requests_collection ON upload_requests(collection_id);
