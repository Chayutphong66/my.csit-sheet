-- Phase 4 completion: additive, reader-ready collection ownership and structure.
-- PostgreSQL 14+ static review: no destructive statements and no legacy-row publication.

ALTER TABLE collections ADD COLUMN IF NOT EXISTS collection_type TEXT NOT NULL DEFAULT 'MIXED'
  CHECK(collection_type IN ('COURSE','MIXED'));
ALTER TABLE collections ADD COLUMN IF NOT EXISTS course_id TEXT REFERENCES courses(id);
ALTER TABLE collections ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'DRAFT'
  CHECK(publication_status IN ('DRAFT','PUBLISHED','ARCHIVED'));
ALTER TABLE collections ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'AUTHENTICATED'
  CHECK(visibility IN ('AUTHENTICATED','PRIVATE'));
ALTER TABLE collections ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'APPROVED'
  CHECK(moderation_status IN ('PENDING','APPROVED','REJECTED'));
ALTER TABLE collections ADD COLUMN IF NOT EXISTS cover_file_asset_id TEXT REFERENCES file_assets(id);
ALTER TABLE collections ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE collections ADD CONSTRAINT collections_course_type_consistency
  CHECK ((collection_type = 'COURSE' AND course_id IS NOT NULL) OR (collection_type = 'MIXED' AND course_id IS NULL));

CREATE TABLE collection_sections (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  UNIQUE(collection_id, id)
);

ALTER TABLE collection_documents ADD COLUMN IF NOT EXISTS section_id TEXT REFERENCES collection_sections(id) ON DELETE SET NULL;

CREATE INDEX idx_collections_owner_status ON collections(created_by, publication_status, updated_at DESC);
CREATE INDEX idx_collections_discovery ON collections(publication_status, moderation_status, collection_type, course_id, updated_at DESC);
CREATE INDEX idx_collection_sections_order ON collection_sections(collection_id, position);
CREATE INDEX idx_collection_documents_order ON collection_documents(collection_id, section_id, position);
