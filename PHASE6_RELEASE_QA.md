# Phase 6 — Release QA & Staging Readiness

Audit date: 2026-10-11 (Asia/Bangkok)

Phase boundary status: local/test verification is complete. The application is **not production ready** while PostgreSQL integration and production-like external storage verification remain blocked.

## Local verification

- Backend: 109 passed, 1 skipped (dedicated PostgreSQL test).
- Frontend: 56 passed across 23 test files.
- Phase 6 isolated workflow: registration/login, Lecture/Sheet upload, COURSE/MIXED Collections, Bulk Upload overrides/partial retry, administrator approval, Collection linking/order/publish, Search/Course/Profile discovery, share/Reader file access, status revocation, deduplication, IDOR, optimistic concurrency, account deactivation, refresh-session revocation, and audit logging passed.
- Lint and production build passed.
- Isolated headless Edge QA passed at 375, 768, 1024, and 1440 px with no detected horizontal overflow. The Reader received authenticated PDF Blob bytes and verified the `%PDF-1.4` header.
- Migrations 001–006 passed static additive checks. No historical migration was modified during Phase 6.

## PostgreSQL isolated execution plan

Do not use `DATABASE_URL`, production credentials, a shared database, or a non-empty database. Create a fresh local PostgreSQL database whose name contains `test`, and expose only its localhost URL as `TEST_DATABASE_URL`. The existing safety guard refuses non-local hosts, names without `test`, and non-empty schemas.

Run the following before staging approval:

1. Apply canonical migrations 001–006 concurrently and confirm every migration is recorded exactly once.
2. Run the migration runner again and confirm a no-op with matching checksums.
3. Validate all schema checks, unique constraints, foreign keys, and rejected orphan references.
4. Force a transaction failure and verify full rollback.
5. Race approval of the same upload and verify one canonical document/file/version result.
6. Race duplicate files and verify one file asset plus deterministic duplicate outcomes.
7. Race retry of the same failed Bulk Upload item and verify no duplicate request/link.
8. Race Collection order writes with the same expected version and verify one success/one conflict.
9. Race last-active-admin deactivation attempts and verify at least one active administrator remains.
10. Verify advisory/session locks release after failures and the connection pool shuts down cleanly.

Command (only after the isolated URL is deliberately configured):

```powershell
$env:TEST_DATABASE_URL = 'postgresql://...localhost.../csit_sheet_test'
npm.cmd run test:backend
```

Leave the test database available for inspection; do not drop or reset it automatically.

## Production-like storage plan

Use a dedicated non-production bucket/project and non-production credentials. Verify upload/download for Lecture, Sheet, revisions and covers; deduplication; object/reference integrity; missing objects; denied direct access; signed/server-mediated access; cover replacement cleanup; retry behavior; and session/account revocation during file reads. Confirm logs and API payloads never expose credentials or private storage keys.

## Production deployment checklist

- [ ] Obtain and install the approved CSIT SHEET 3D logo source; rerun Navbar visual regression.
- [ ] Complete the isolated PostgreSQL plan above with zero failures.
- [ ] Complete production-like external storage verification with zero unauthorized reads.
- [ ] Review the exact commit/diff and confirm no role, secret, demo-user, or production-data change.
- [ ] Back up the production database and verify restore instructions and backup integrity.
- [ ] Export current migration ledger, schema version, active-admin count, and storage reference report.
- [ ] Rehearse migrations 001–006 against a restored staging copy and record duration/locks.
- [ ] Run smoke tests for auth, upload, approval, Collections, Reader, deactivation and health checks in staging.
- [ ] Obtain separate written approval for production deployment and production migration.
- [ ] Define deploy owner, rollback owner, maintenance window, monitoring window, and abort thresholds.

## Rollback and backup plan

1. Before deployment, create a timestamped database backup/snapshot and storage inventory; verify a restore into an isolated environment.
2. Preserve the current application artifact and environment configuration references without copying secret values into reports.
3. Deploy application code before any optional feature enablement and run read-only health/smoke checks.
4. If application errors exceed the agreed threshold, roll back the application artifact first. Migrations 004–006 are additive, so retain their columns/tables during application rollback.
5. Do not run down-migrations or destructive cleanup during the incident. Any schema removal requires a separate reviewed maintenance plan after dependency and retention checks.
6. If data integrity is affected, stop writes, preserve logs, compare the migration ledger/checksums, and restore only under an approved incident procedure.
7. Reconcile object storage against database references after restore; never delete unmatched production objects automatically.

## Remaining blockers

- BLOCKED: PostgreSQL integration, row-lock behavior, concurrent retry/order, and last-admin concurrency.
- BLOCKED: production-like external object storage verification.
- BLOCKED: approved CSIT SHEET 3D logo source is not present.
- NOT VERIFIED: native PDF content rendering across the supported browser/OS matrix; local Edge verified authenticated Blob delivery, iframe embedding, and PDF bytes.
- NOT PERFORMED: production deploy, production migration, production database/storage changes, role changes, or secret changes.
