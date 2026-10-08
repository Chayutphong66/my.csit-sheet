ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name_changed_at TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_storage_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_public INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_program INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_cohort INTEGER NOT NULL DEFAULT 1;

UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at) WHERE is_verified = 1;

CREATE TABLE account_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('EMAIL_VERIFICATION','PASSWORD_RESET')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE user_follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

CREATE TABLE profile_change_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('PROGRAM','COHORT')),
  current_value TEXT NOT NULL,
  requested_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reviewer_id TEXT REFERENCES users(id),
  decision_reason TEXT NOT NULL DEFAULT '',
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  new_follower INTEGER NOT NULL DEFAULT 1,
  followed_documents INTEGER NOT NULL DEFAULT 1,
  document_activity INTEGER NOT NULL DEFAULT 1,
  activity_email INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE email_deliveries (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  template TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SENT','MOCKED','UNAVAILABLE','FAILED')),
  provider_message_id TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE INDEX idx_account_tokens_lookup ON account_tokens(token_hash, purpose, expires_at);
CREATE INDEX idx_account_tokens_user ON account_tokens(user_id, purpose, created_at DESC);
CREATE INDEX idx_follows_followed ON user_follows(followed_id, created_at DESC);
CREATE INDEX idx_follows_follower ON user_follows(follower_id, created_at DESC);
CREATE INDEX idx_profile_change_user ON profile_change_requests(user_id, created_at DESC);
CREATE INDEX idx_profile_change_status ON profile_change_requests(status, created_at);
CREATE UNIQUE INDEX idx_profile_change_pending_unique ON profile_change_requests(user_id, category) WHERE status = 'PENDING';
