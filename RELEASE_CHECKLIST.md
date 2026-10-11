# Release Checklist

## Phase 3 — Admin User Management

- [x] Local additive migration `004_admin_user_management.sql` reviewed; no destructive statements.
- [x] Application rollback plan documented: roll back application code first and retain additive columns/audit rows. Remove schema only in a separately reviewed maintenance window after confirming no dependencies.
- [x] Admin User Management RBAC, IDOR, validation, editing, deactivation/reactivation, referential-integrity, session-revocation, and audit-log regression tests added.
- [x] Responsive Admin User Management QA completed at 375, 768, 1024, and 1440 px.
- [ ] Run the dedicated PostgreSQL integration suite with `TEST_DATABASE_URL`; it remains skipped when that local test database is not provided.
- [x] Reconciled legacy Admin Review visual assertions with semantic filters/actions, preview bytes, deterministic pending-item selection, and keyboard-dialog focus checks.
- [ ] Do not report Full Regression as passed until the PostgreSQL item above is verified.

## Release Safety

- [ ] Apply migration in staging only after backup and migration review.
- [ ] Verify active-admin count and configured administrator accounts in staging before enabling account-status actions.
- [ ] Confirm no role, password, authentication secret, or production administrator record changes are included.
- [ ] Production deployment and production migration require separate approval.

## Phase 4 Completion — Collection Platform

- [x] Additive `006_collection_completion.sql` created; migrations 001–005 were not rewritten.
- [x] Legacy collections remain `DRAFT`; no legacy row is silently published or assigned to another owner.
- [x] SQLite schema/transfer order and schema readiness include lifecycle, COURSE/MIXED, sections, ordering, and cover references.
- [x] User ownership, cross-user IDOR, admin/owner separation, draft privacy, document visibility, cover validation, upload limits, retry idempotency, and optimistic order concurrency pass on SQLite.
- [x] Lecture and Sheet approval-to-Collection linkage pass on SQLite.
- [x] Profile, Course, Search, share page, user Bulk Upload, and responsive Collection management QA pass locally.
- [ ] Run migrations 001–006 twice against a fresh dedicated local PostgreSQL database using `TEST_DATABASE_URL`.
- [ ] Verify PostgreSQL row locks/advisory locks for concurrent approval, duplicate detection, ordering, and retry.
- [ ] Verify the last-active-admin guard under concurrent PostgreSQL transactions.
- [ ] Verify external production-like storage upload/download and cover cleanup behavior.
- [ ] Production deploy/migration requires separate approval.

## Phase 5 — Sequential Reader

- [x] Collection Reader, TOC, Section/Document ordering, Previous/Next, Lecture/Sheet metadata, empty/error states, keyboard navigation and responsive layout verified locally.
- [x] Reader file access rechecks authentication, published/authenticated Collection visibility, membership and approved document status on every request.
- [x] PDF Blob creation and cleanup covered by frontend tests; authenticated PDF bytes and iframe embedding verified in isolated headless Edge.
- [ ] Verify native PDF content rendering across the supported browser/OS release matrix.
- [ ] Install the approved CSIT SHEET 3D logo after the source asset is provided; do not generate a substitute.

## Phase 6 — Release QA

- [x] Isolated USER1 → ADMIN → USER2 workflow passes on SQLite/Test storage.
- [x] Backend, Frontend, Lint, Production Build and Responsive/Visual QA pass.
- [x] API contract, RBAC, IDOR, mass assignment, visibility, status revocation, upload validation, concurrency, session revocation and audit regressions pass locally.
- [x] Migration 001–006 static additive review passes; historical migration files were not edited in Phase 6.
- [ ] Execute the isolated PostgreSQL plan in `PHASE6_RELEASE_QA.md`.
- [ ] Execute production-like external storage verification.
- [ ] Production deployment remains prohibited until blockers pass and separate approval is granted.

## Phase 7 — Staging Verification and Production Readiness

- [x] Added an ephemeral GitHub Actions PostgreSQL 16 service database named `csit_sheet_test`; no local installation or production connection fallback.
- [x] Added tests for migrations `001`–`006`, concurrent migration/idempotency/checksum ledger, constraints, rollback, approval, retry, deduplication, Collection ordering and last-admin concurrency.
- [x] Added isolated CI backup/restore and secret-free migration/storage inventory tooling.
- [x] Added fail-closed staging environment contract and read-only smoke tooling.
- [x] Added a manual isolated Supabase lifecycle workflow; it never falls back to production variable names.
- [ ] Obtain a green PostgreSQL Integration workflow run from the release commit.
- [ ] Provision or nominate an isolated Supabase test project/bucket and add only `TEST_SUPABASE_*` credentials after separate approval.
- [ ] Obtain a green Isolated External Storage Verification workflow run.
- [ ] Provision/deploy an approved staging environment, verify backup restore, then complete staging E2E and browser/storage checks.
- [ ] Install the approved 3D logo source asset when supplied; do not generate a substitute.
- [ ] Production deployment and production migration remain prohibited until all release blockers pass and separate approval is granted.
