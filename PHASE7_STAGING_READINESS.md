# Phase 7 — Staging Verification and Production Readiness

## Scope and safety boundary

Phase 7 prepares isolated CI/staging verification only. It does not deploy, provision cloud resources, use production credentials, change administrator roles/secrets, or run a production migration. PostgreSQL migrations `001`–`006` remain historical inputs and were not edited.

## PostgreSQL CI lane

`.github/workflows/postgresql-integration.yml` starts an ephemeral PostgreSQL 16 service database named `csit_sheet_test`. The database hostname and name satisfy the existing test guard (`localhost`/`127.0.0.1` and a name containing `test`). The job:

1. applies every canonical migration to an empty database through the application migration runner;
2. verifies concurrent migration execution, repeat no-op behavior, ledger checksums and checksum-tamper rejection;
3. verifies CHECK and foreign-key enforcement plus transaction rollback;
4. exercises concurrent approval, retry, file deduplication, optimistic Collection ordering and the last-active-admin guard;
5. creates a custom-format `pg_dump`, restores it into `csit_sheet_restore_test`, and compares migration ledgers, table sets and every table row count;
6. exports a secret-free migration/storage inventory as a short-lived CI artifact.

The service container is ephemeral. A passing workflow run is required evidence; workflow presence or SQLite results are not PostgreSQL verification.

## Isolated external storage lane

`.github/workflows/external-storage-verification.yml` is manual-only and targets the protected GitHub Environment `isolated-storage`. It requires `TEST_SUPABASE_URL`, `TEST_SUPABASE_SECRET_KEY`, and `TEST_SUPABASE_STORAGE_BUCKET` environment secrets.

The bucket name must contain `staging`, `test`, or `qa`. The test requires the exact `ISOLATED-NON-PRODUCTION` safety token, writes one unique content-addressed object, verifies read/deduplicated save/metadata, removes it in `finally`, and verifies it is gone. Production-named variables are never used as fallbacks. Creating a Supabase project/bucket or adding credentials needs separate authorization; until an isolated target exists and this workflow passes, external storage is a release blocker.

## Staging configuration and smoke checks

`config/staging.env.example` is a non-secret contract. Real values belong in a staging secret manager. After injecting staging variables, run `npm run staging:preflight`.

The preflight requires production-mode security behavior, PostgreSQL, Supabase storage, an independent 32+ character JWT secret, HTTPS origin/CORS alignment, secure cookies, a staging/test/QA database and bucket, and the explicit isolation token. It rejects known production database/storage equality when `PRODUCTION_*` comparison values are supplied.

After a separately approved staging deployment, set `RUN_STAGING_SMOKE=true`, `STAGING_SAFETY_TOKEN=ISOLATED-NON-PRODUCTION`, and an HTTPS `STAGING_BASE_URL` whose hostname identifies staging/test/QA, then run `npm run staging:smoke`. It checks database-backed health, API routing, rejection of an untrusted CORS origin, and the static frontend. Authentication, upload, approval, Collection/Reader, cookies, and session expiration remain staging E2E checks and are not represented by this read-only smoke.

## Backup and restore procedure

For staging first, then for production only after separate approval:

1. Put writes into the approved maintenance posture and record the application release identifier.
2. Export the current migration ledger and aggregate storage inventory. Never export object keys or secrets into general logs.
3. Run `pg_dump --format=custom --no-owner` using the target's protected database credential.
4. Record the dump checksum, PostgreSQL client/server versions, timestamp, retention policy and encrypted backup location.
5. Restore into a newly created isolated verification database with `pg_restore --no-owner --exit-on-error`; never overwrite the source.
6. Compare migration ledger names/checksums, schema table set, table row counts, foreign keys and representative application reads.
7. Export the external bucket inventory (object count, total bytes and hash/reference reconciliation) without downloading production objects during this Phase.
8. Retain the verified backup until the release observation window closes.

The CI implementation automates database dump/restore verification for temporary test databases through `npm run verify:postgres-restore`. Actual staging backup/restore and external storage inventory are not verified until isolated services exist.

## Production deployment plan (not authorized)

1. Obtain explicit production approval only after PostgreSQL CI and isolated external storage are green, staging E2E is complete, and the original 3D logo decision is resolved or explicitly deferred.
2. Freeze the release commit and review its diff, dependency audit, migration ledger and migrations `001`–`006` hashes.
3. Verify backup restore in isolation, storage inventory/reference integrity, active-admin count and rollback owner.
4. Back up the production database and inventory storage using production-approved operational access.
5. Apply migrations with the canonical migration runner once; stop on checksum or schema error.
6. Deploy the pinned application artifact, run health/read-only smoke, then the approved minimal write workflow.
7. Monitor authentication, database, storage and 5xx telemetry through the observation window.

## Rollback plan

- Application failure: redeploy the previously pinned artifact and keep additive schema/data intact.
- Migration failure before commit: the migration runner rolls that migration back and does not add a ledger row.
- Post-migration incompatibility: roll back application code first. Do not reverse migrations `001`–`006` ad hoc; they are additive and may contain new data.
- Data corruption: halt writes and restore the verified dump into a new database, validate it, then switch the connection through the approved change process.
- Storage fault: stop writes, preserve objects, reconcile database references against the isolated inventory, and restore/copy objects only through provider-approved tooling.
- Credential exposure: revoke and rotate the affected secret separately; never copy staging secrets into production.

## Current release readiness

Local verification on 2026-10-11: backend 116 passed / 2 skipped / 0 failed (the skipped tests require PostgreSQL and isolated Supabase), frontend 56 passed / 0 failed, lint passed, production build passed, and Responsive/Visual QA passed at 375, 768, 1024, and 1440 px with zero horizontal-overflow findings. PostgreSQL and external-storage execution results are deliberately not inferred from these local results.

| Area | Status | Evidence / gate |
| --- | --- | --- |
| PostgreSQL workflow definition | PASSED | Ephemeral service, safety URL, test DB, backup/restore and artifact steps are present. |
| PostgreSQL integration execution | BLOCKED | Requires a pushed GitHub Actions run; no local PostgreSQL/Docker is available. |
| External adapter contract/local mocks | PASSED | Existing adapter tests plus isolated lifecycle test code. |
| Isolated external storage execution | BLOCKED | Requires a separately approved Supabase test project/bucket and test-only credentials. |
| Staging configuration contract | PASSED | Automated fail-closed preflight tests. |
| Staging deployment/E2E | BLOCKED | No staging environment was provisioned or deployed. |
| CI backup/restore execution | BLOCKED | Runs after PostgreSQL integration in GitHub Actions. |
| Staging backup/restore | BLOCKED | Requires isolated staging PostgreSQL. |
| Branding source | BLOCKED | Original CSIT SHEET 3D logo file has not been provided. |
| Production deployment | BLOCKED | Prohibited in Phase 7 and requires separate approval. |

The project must not be reported Production Ready while PostgreSQL CI, isolated external storage, and staging E2E/restore evidence are incomplete.
