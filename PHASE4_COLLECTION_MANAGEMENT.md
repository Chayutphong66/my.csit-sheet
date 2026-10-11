# Phase 4 — Collection Management & Bulk Upload

Phase boundary status: Phase 4 implementation is complete for SQLite-first local development. Phase 5 implementation and Phase 6 local release QA are documented separately; PostgreSQL and external-storage release blockers remain.

## Implementation

- Added administrator collection create/list/detail/update/archive workflows. Collections are archived, not hard-deleted.
- Added an administrator bulk-upload workflow for 1–20 files with per-item `READY`, `DUPLICATE`, or `FAILED` outcomes.
- Added retry for failed items only. Successful items are retained and are not replayed.
- Bulk items create ordinary pending upload requests and therefore use the existing approval, validation, fingerprint, file-asset deduplication, and publication paths.
- Approved bulk items are linked to their requested collection once, using a composite primary key for idempotency.
- Bulk job lookup is creator-scoped in addition to the administrator role guard, preventing cross-admin job ID access.
- Added a responsive administrator UI at `/admin/collections`.
- Repaired admin-review visual assertions to use stable semantic attributes and verified preview bytes instead of legacy display text.

## Database changes

Canonical additive PostgreSQL migration: `backend/migrations/postgres/005_collection_bulk_upload.sql`.

New tables:

- `collections`
- `collection_documents`
- `bulk_upload_jobs`
- `bulk_upload_items`

New nullable column:

- `upload_requests.collection_id`

SQLite local schema and SQLite transfer inspection/order were updated for the same shape. Migration 005 received static checks for additive DDL, required foreign keys, and absence of statement-level `DROP`, `TRUNCATE`, or `DELETE`. It was not executed against PostgreSQL or production.

## API changes

- `GET /api/admin/collections`
- `POST /api/admin/collections`
- `GET /api/admin/collections/:id`
- `PATCH /api/admin/collections/:id`
- `POST /api/admin/bulk-uploads`
- `GET /api/admin/bulk-uploads/:id`
- `POST /api/admin/bulk-uploads/:id/retry`

All routes require authenticated `ADMIN` access. No role-management or secret-management API was added.

## Verification results

### PASSED

- Backend automated tests: 95 passed.
- Frontend automated tests: 45 passed across 21 files.
- Phase 4 SQLite integration: collection CRUD/archive, bulk upload, approval integration, RBAC, cross-admin IDOR, binary deduplication, partial failure, retry, idempotent collection linkage, and foreign-key integrity.
- Existing last-active-admin guard: passed on SQLite.
- PostgreSQL migration runner test: dynamically discovers all current canonical migrations and retains session lock, checksum, ledger, transaction, rollback, and repeat no-op guards.
- Lint: passed.
- Frontend and Netlify function build: passed.
- Responsive/browser QA: passed at 375, 768, 1024, and 1440 px; 149 screenshots, 169 checks, zero reported errors, and no detected overflow. Three-actor browser lifecycle passed.

### SKIPPED

- Dedicated local PostgreSQL integration test: skipped because `TEST_DATABASE_URL` was not provided. The safety guard still requires localhost/127.0.0.1 and a database name containing `test`.

### BLOCKED (release blockers before deploy)

- Run the complete canonical migration set, including 005, twice against a fresh dedicated PostgreSQL test database.
- Verify PostgreSQL row-lock/advisory-lock behavior for concurrent approval, deduplication, and same-item retry. SQLite serialization is not equivalent evidence.
- Verify the last-active-admin guard under real PostgreSQL concurrent transactions.
- Verify bulk file persistence and download with the production-like storage adapter/configuration.

### NOT VERIFIED

- PostgreSQL DDL execution and rollback behavior for migration 005.
- PostgreSQL query/runtime compatibility beyond static review and SQL translation unit coverage.
- Production-like external object storage for bulk uploads.
- Production deployment, production migration, production data, roles, and secrets (intentionally untouched).

## Remaining risks

- Concurrent retry of the same failed item needs PostgreSQL row-lock verification before release.
- SQLite cannot validate PostgreSQL constraint timing, lock semantics, query plans, or provider-specific storage failures.
- Bulk requests carry base64 payloads through the existing JSON boundary; the application request-size limit remains the effective aggregate cap even though each item also has a 20 MB validation limit.

## PostgreSQL compatibility checklist

- [x] Migration number follows 004.
- [x] Additive schema only; no destructive DDL/DML statements.
- [x] Foreign-key creation order reviewed.
- [x] Migration runner discovers five canonical files and preserves safety guards.
- [x] SQLite transfer dependency order updated for collection references.
- [x] Placeholder/`INSERT OR IGNORE` translation paths covered by existing unit tests.
- [ ] Fresh PostgreSQL migration execution.
- [ ] Second migration no-op and checksum verification on PostgreSQL.
- [ ] PostgreSQL concurrent retry/approval/deduplication verification.
- [ ] PostgreSQL last-admin concurrency verification.
- [ ] Production-like storage verification.

No deploy, production database operation, production migration, role change, or secret change was performed.

## Phase 4 Completion Addendum

Migration `006_collection_completion.sql` extends the existing implementation without rewriting migration 005. It adds COURSE/MIXED semantics, DRAFT/PUBLISHED/ARCHIVED lifecycle, authenticated/private visibility, moderation state, cover asset references, optimistic versions, sections, and section membership.

Authenticated users now have owner-scoped Collection management and Bulk Upload. Publicly shareable routes remain authentication-protected. Every Collection read rechecks authoritative Lecture/Sheet approval status. Profile, Course, and Search discovery use bounded database queries. The UI includes explicit order saving and keyboard-accessible up/down controls.

Local verification after completion: backend 105 passed with one PostgreSQL test skipped, frontend 50 passed, lint passed, full build passed, and responsive QA passed at 375/768/1024/1440 px with no detected overflow. PostgreSQL execution, real row-lock semantics, last-admin concurrency, and production-like external storage remain release blockers.
