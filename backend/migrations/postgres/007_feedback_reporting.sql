-- Authenticated product feedback with an append-only review history.

CREATE TABLE feedback_reports (
  id TEXT PRIMARY KEY,
  public_reference TEXT NOT NULL UNIQUE,
  reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  client_request_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('BUG','FEEDBACK','FEATURE_REQUEST','INCORRECT_CONTENT')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  related_path TEXT NOT NULL DEFAULT '',
  related_document_type TEXT NOT NULL DEFAULT '' CHECK(related_document_type IN ('','Lecture','Sheet')),
  related_document_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_REVIEW','RESOLVED','CLOSED','DUPLICATE')),
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  resolved_at TEXT,
  UNIQUE(reporter_user_id, client_request_id),
  CHECK ((related_document_type = '' AND related_document_id = '') OR
         (related_document_type <> '' AND related_document_id <> ''))
);

CREATE TABLE feedback_report_events (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('CREATED','STATUS_CHANGED','NOTE_ADDED','PUBLIC_MESSAGE')),
  previous_status TEXT NOT NULL DEFAULT '',
  new_status TEXT NOT NULL DEFAULT '',
  internal_note TEXT NOT NULL DEFAULT '',
  public_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE INDEX idx_feedback_reporter_created ON feedback_reports(reporter_user_id, created_at DESC);
CREATE INDEX idx_feedback_admin_queue ON feedback_reports(status, category, created_at DESC);
CREATE INDEX idx_feedback_events_report ON feedback_report_events(report_id, created_at, id);
