# Phase 1: provider-neutral preparation (local only)

No deployment, push, production connection, resource creation, real data transfer,
or Supabase object upload was performed. Existing local SQLite databases and user
uploads were not opened or changed during verification. Tests create separate
temporary fixtures. Future target: Vue on Netlify -> Express on Railway ->
Supabase PostgreSQL and a private Supabase Storage bucket. The existing application
authentication remains; Supabase Auth is not used.

## Architecture found before changes

| Boundary | Current path and observations |
| --- | --- |
| Application | Express routes/controllers/services and repositories implement the existing academic/community/version workflows. Vue uses one Axios client with in-memory access JWTs and credentialed requests. |
| SQLite | `backend/src/data/database.js` owns local schema reconciliation, seeds and SQLite file bytes; tests use isolated temporary files. Old `server.js` and maintenance CLIs directly imported it. |
| PostgreSQL | `databaseClient.js` already translated repository placeholders and selected a pool from `@netlify/database`; valid PostgreSQL schema existed in Netlify migrations. |
| Netlify | Runtime detection selected the DB; Function wrappers, two migration directories, Blobs and production frontend file-route selection depended on Netlify. |
| Storage | Relational FileAsset references and SHA-256 deduplication already existed. Local bytes were stored in SQLite; the Function path stored canonical objects in Blobs and staged chunks separately. |
| Deployment | Root build created Vue and ESM Function bundles; `netlify.toml` routed API/Blob requests to those bundles. |
| Transitional/duplicated | Provider migrations and generated Function output are transitional, not the new canonical migration lifecycle. `storageReport.js`/`seed.js` remain explicitly local SQLite tools; no core feature was removed as supposedly dead code. |
| Actual entry points | Local: `server.js` -> app; Netlify: API wrapper -> app, plus native streaming Blob wrapper; tests: import app without listener startup and open temporary SQLite fixtures. |

## Configuration and lifecycle

`backend/src/config/environment.js` validates driver, origins, token duration,
cookie policy, pool bounds and port. SQLite defaults only outside production.
Postgres always requires `DATABASE_URL`. Production rejects SQLite even with
`DATABASE_PATH` present. Direct local SQLite entry points also reject production
or `DATABASE_DRIVER=postgres` before opening a file. No provider runtime flag
controls application database selection.

`DATABASE_DRIVER=postgres` uses one lazy, bounded `pg.Pool`. Transactions pin one
client and release it after commit/rollback. Concurrent local SQLite transactions
are serialized. Startup checks connection/schema without production DDL, then
listens on supplied `PORT` and `0.0.0.0` in production. SIGTERM/SIGINT drain HTTP
and close DB resources, with a 10-second deadline. Health returns 200 with
`status: ok, database: ready`, or safe 503 categories. No secret/stack is returned.

Local SQLite retains its legacy initialization behavior. Production PostgreSQL
migrations never run from application startup or HTTP requests.

## Environment checklist

All backend variables belong in the backend process environment, never a Vite
build variable. Configure future Railway variables only in the approved later
phase; no Railway service or Supabase resource is needed for local SQLite.

| Variable | Required | Secret | Purpose |
| --- | --- | --- | --- |
| NODE_ENV | production: yes | no | Production fail-closed behavior. |
| PORT | hosting supplied / local 8080 | no | HTTP listener. |
| HOST | optional | no | Production defaults 0.0.0.0. |
| DATABASE_DRIVER | recommended explicit | no | sqlite locally; postgres in production. |
| DATABASE_PATH | optional, local only | no | Existing local SQLite location. Ignored by the Postgres client. |
| DATABASE_URL | postgres: yes | YES | Generic PostgreSQL URL; use verified TLS configuration for future Supabase. |
| DATABASE_POOL_MAX | optional | no | Bounded pool, default 5, maximum 50. Size against the actual future DB connection limit. |
| JWT_SECRET | production: yes | YES | Existing access JWT signing; production check retained. |
| ACCESS_TOKEN_TTL | optional | no | Default 15m. |
| REFRESH_TOKEN_TTL_DAYS | optional | no | Default 7 days; same setting governs cookie expiry. |
| ALLOWED_ORIGINS | production: yes, or FRONTEND_URL | no | Explicit comma-separated origins; production HTTPS only. No wildcard. |
| FRONTEND_URL | alternative to ALLOWED_ORIGINS | no | Single allowed frontend origin. |
| COOKIE_SAME_SITE | optional; future cross-site: none | no | strict production default, lax local; none requires production Secure cookies. |
| STORAGE_DRIVER | recommended explicit | no | database local, supabase future production; netlify is transitional. |
| SUPABASE_URL | Supabase storage operations: yes | no | Project HTTPS URL. Adapter remains lazy and unused locally. |
| SUPABASE_SECRET_KEY | Supabase storage operations: yes | YES | Canonical backend-only Secret key (`sb_secret_...`). Never send to frontend. The legacy `SUPABASE_SERVICE_ROLE_KEY` name remains a temporary compatibility fallback only. |
| SUPABASE_STORAGE_BUCKET | Supabase storage operations: yes | no | Future private bucket; adapter never creates it. |
| BOOTSTRAP_ADMIN_EMAIL | optional/temporary | no (owner identity) | Existing first-admin policy; remove after explicitly bootstrapping. |
| TEST_DATABASE_URL | optional verification only | YES | Fresh, dedicated local PostgreSQL database with test in its name. Never production. |
| VITE_API_URL | frontend public build only | no | /api locally/current site; future approved external Express URL ending /api. |

Refresh tokens stay HttpOnly; access tokens stay in memory. Future cross-site
auth requires explicit `COOKIE_SAME_SITE=none`, Secure HTTPS, an exact frontend
origin and Axios credentials. Browser third-party-cookie restrictions may still
block sessions; a shared custom site/domain strategy may be needed later. Do not
move refresh tokens to localStorage or weaken CORS to bypass this.

`.env` and `.env.*` are ignored except the safe `.env.example`. No tracked `.env`
files or commits touching the standard root/backend/frontend `.env` paths were
found in the available history. This is not an exhaustive historical secret audit.
The backend does not automatically load `.env`: inject variables into the shell,
or from the repository root use `node --env-file=.env backend/src/server.js`.
Likewise a local migration can use `node --env-file=.env backend/src/data/migrate.js`.

## Canonical PostgreSQL migrations

Canonical directory: `backend/migrations/postgres/`.

`npm run db:migrate` uses the selected driver. In PostgreSQL mode it applies
ordered forward SQL with a session advisory lock, transactional migration+ledger
updates, and SHA-256 checksums in `app_schema_migrations`. Applied migrations are
not rerun. Modified/missing historical files and out-of-order additions fail.
The baseline reuses the existing schema, including all 24 feature tables and
unique version/star/file constraints. Achievements and contribution scores remain
derived aggregates, not a second schema. New timestamps match SQLite UTC text
(`YYYY-MM-DD HH:mm:ss`). A second migration adds provider-neutral storage fields,
retains `blob_key` compatibility, and permits inline bytes during a reviewed
future transfer. No production seed users or automatic reset/drop exist.

Do not point this fresh-baseline runner at the existing populated Netlify DB.
Existing deployments need an explicitly reviewed adoption/baseline policy;
never fabricate or clear migration history. Future flow is controlled migration,
then normal Express start. No release/deploy configuration was created now.

The session advisory migration lock requires a direct or session-mode PostgreSQL
connection. Do not run migrations through a transaction-mode pooler. Later choose
the appropriate endpoint explicitly, without adding duplicate secret variables or
disabling TLS verification.

## SQLite transfer tool

Default, source-only command (no Postgres credentials required):

```text
npm run db:transfer -- --source=<absolute-path-to-a-reviewed-SQLite-copy>
```

Reads SQLite with `readOnly: true` and a consistent read snapshot. Reports tables,
integrity/FK checks, primary keys, required/null fields, unsupported schema,
polymorphic document/current-version references, asset SHA-256/size, and candidate
demo usernames separately. Hashes/passwords are never printed or rewritten.
Externally referenced assets without source bytes block apply. Custom tables or
unsupported fields also block rather than being silently discarded.

Future apply requires BOTH `--apply` and `--demo-policy=include`, plus a deliberately
configured target `DATABASE_URL`. There is no exclusion policy yet because it
would require a reviewed dependency graph. Target must be newly migrated and
empty except untouched canonical CS/IT program seeds, verified before import.
One transaction/advisory lock preserves IDs, hashes, roles, program/cohort,
timestamps, versions, stars and all other current columns; DB FKs validate the
target, and row-count/hash comparisons precede commit. Target merge/resume and
production object migration are NOT implemented or executed in this phase.

## Storage boundary

The adapter offers save/read/delete/exists/metadata with validated storage keys.
Local canonical data remains persistent SQLite FileAsset bytes, not an in-memory
or Railway filesystem fallback. Only temporary local upload sessions use a Map.
Supabase uses authenticated server-side Storage HTTP requests, immutable SHA-256
object keys, bounded request time, private backend proxy download/view and generic
503 errors; tests mock HTTP and do not contact Supabase. Metadata includes SHA,
size, MIME and filename; relational references preserve uploader/version/time.
New Postgres records keep `storage_key`/`storage_provider` and legacy `blob_key`
for existing file-query compatibility.

Orphan cleanup rechecks references inside its transaction and locks Postgres rows.
It removes only unreferenced DB assets. External objects are intentionally retained
because deletion after commit can race a reupload of the same SHA. A later reviewed
GC/tombstone protocol is required to reclaim external storage safely. Published
objects are never deleted automatically in this phase.

## Transitional Netlify code

Existing Function wrappers, native Blob delivery, `netlify.toml`, old migrations,
SDK dependencies and generated bundles remain. A small Function-only environment
bridge maps legacy `NETLIFY_DB_URL` to generic configuration; core DB code imports
no Netlify DB SDK and does not detect Netlify. Netlify-only file insertion retains
compatibility with the old schema. `pg` stays external to legacy ESM bundles.
Vue uses legacy Blob routes only for the current same-origin production API;
an absolute external `VITE_API_URL` uses ordinary Express file endpoints.
Do not deploy these changes or alter the current site API URL without approval.

## Verification and remaining work

Run `npm run test:backend`, `npm run test:frontend`, `npm run lint`, `npm run build`.
Backend regression covers authentication, CS/IT/cohort, academic hierarchy, upload,
admin authorization/review, file view/download, search, stars, contributions,
duplicates, version history and restore. New tests cover invalid configuration,
safe failures, concurrency, rollback, shutdown, read-only dry-run, migration lock/
ledger/checksum control flow and mocked Supabase operations. Real PostgreSQL test
is skipped without `TEST_DATABASE_URL`; when supplied it refuses a nonlocal or
non-empty target and leaves test records for inspection without dropping tables.

Limits not verified: actual Supabase pool/SSL/schema compatibility, live Storage,
browser cross-site cookies, Railway deployment/restart and production persistence.
The SQLite-to-Postgres apply path still needs a real dedicated target rehearsal.
`npm audit` reported 9 high-severity dependency findings (including existing Axios
and lint-tool chains); no broad dependency upgrade was made as part of this refactor.
Review those advisories before production deployment.

Final local verification: backend 71 passed, 0 failed, 1 PostgreSQL integration
test skipped (`TEST_DATABASE_URL NOT PROVIDED`); frontend 33 passed in 17 files;
lint passed; Vue and transitional ESM Function builds passed; `git diff --check`
passed. Supabase adapter and transfer-apply tests used simulated clients only.
Real PostgreSQL/Supabase integration and production persistence were NOT EXECUTED.

Next recommended phase, ONLY after owner approval: create Supabase PostgreSQL +
Storage and test LOCAL Express against Supabase before creating Railway. Phase 2
has not begun.

## Changed files

| File | Reason |
| --- | --- |
| [.env.example](.env.example) | Central validated backend configuration; safe public/private variable examples. |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Document Phase1 scope, architecture, configuration, verification and later approval boundary. |
| [PHASE1_PREPARATION.md](PHASE1_PREPARATION.md) | Document Phase1 scope, architecture, configuration, verification and later approval boundary. |
| [README.md](README.md) | Document Phase1 scope, architecture, configuration, verification and later approval boundary. |
| [backend/migrations/postgres/001_initial_schema.sql](backend/migrations/postgres/001_initial_schema.sql) | Canonical reused 24-table schema, UTC text timestamps, constraints and preserved relationships. |
| [backend/migrations/postgres/002_storage_references.sql](backend/migrations/postgres/002_storage_references.sql) | Provider-neutral object references; preserve legacy Blob compatibility. |
| [backend/package.json](backend/package.json) | Direct pg dependency, migration/transfer commands and external pg bundle option. |
| [backend/src/app.js](backend/src/app.js) | Explicit credentialed CORS, safe health503, request IDs and generic errors. |
| [backend/src/config/environment.js](backend/src/config/environment.js) | Central validated backend configuration; safe public/private variable examples. |
| [backend/src/controllers/auth.controller.js](backend/src/controllers/auth.controller.js) | Validated matching login/logout cookie attributes and request-ID diagnostics. |
| [backend/src/data/cleanupFileAssets.js](backend/src/data/cleanupFileAssets.js) | Await generic maintenance operations and close the DB. |
| [backend/src/data/database.js](backend/src/data/database.js) | Reject direct SQLite access in production before touching files. |
| [backend/src/data/databaseClient.js](backend/src/data/databaseClient.js) | Generic lazy pg pool, pinned transactions, local serialization and locks. |
| [backend/src/data/importCoursesCli.js](backend/src/data/importCoursesCli.js) | Close the pool and safely log CLI failures. |
| [backend/src/data/migrate.js](backend/src/data/migrate.js) | Explicit selected-driver migrations with lock, ledger, checksum and transactions. |
| [backend/src/data/postgresMigrations.js](backend/src/data/postgresMigrations.js) | Explicit selected-driver migrations with lock, ledger, checksum and transactions. |
| [backend/src/data/postgresSql.js](backend/src/data/postgresSql.js) | Data-layer bound SQL translation without altering quoted values/comments. |
| [backend/src/data/schemaRequirements.js](backend/src/data/schemaRequirements.js) | Readiness checks for all feature tables and critical columns. |
| [backend/src/data/sqliteTransfer.js](backend/src/data/sqliteTransfer.js) | Read-only source validation, explicit apply/policy, full-value verification and rollback. |
| [backend/src/data/transferSqliteCli.js](backend/src/data/transferSqliteCli.js) | Read-only source validation, explicit apply/policy, full-value verification and rollback. |
| [backend/src/repositories/documentVersion.repository.js](backend/src/repositories/documentVersion.repository.js) | Document row locks and duplicate-hash serialization. |
| [backend/src/repositories/fileAsset.repository.js](backend/src/repositories/fileAsset.repository.js) | Preserve local bytes, add storage metadata, validate SHA and race-safe orphan cleanup. |
| [backend/src/repositories/refreshToken.repository.js](backend/src/repositories/refreshToken.repository.js) | Atomic refresh rotation/revocation and fail-closed UTC expiry. |
| [backend/src/repositories/uploadRequest.repository.js](backend/src/repositories/uploadRequest.repository.js) | Serialize duplicate classification and idempotent publication. |
| [backend/src/repositories/user.repository.js](backend/src/repositories/user.repository.js) | Convert duplicate insert races into safe409 conflicts. |
| [backend/src/server.js](backend/src/server.js) | Validated PORT/host, startup readiness and bounded graceful shutdown. |
| [backend/src/services/fileStorage.service.js](backend/src/services/fileStorage.service.js) | Provider-neutral persistent local/remote storage boundary and staged upload sessions. |
| [backend/src/services/safeLogger.service.js](backend/src/services/safeLogger.service.js) | Redact Supabase/test-DB secrets, JWTs and password hashes. |
| [backend/src/services/serverLifecycle.js](backend/src/services/serverLifecycle.js) | Validated PORT/host, startup readiness and bounded graceful shutdown. |
| [backend/src/services/storageAdapter.js](backend/src/services/storageAdapter.js) | Provider-neutral persistent local/remote storage boundary and staged upload sessions. |
| [backend/src/services/token.service.js](backend/src/services/token.service.js) | Atomic refresh rotation/revocation and fail-closed UTC expiry. |
| [backend/src/services/uploadSession.service.js](backend/src/services/uploadSession.service.js) | Provider-neutral persistent local/remote storage boundary and staged upload sessions. |
| [backend/test/auth.test.js](backend/test/auth.test.js) | Regression/infrastructure coverage; dedicated real PostgreSQL test remains gated. |
| [backend/test/document-versioning.test.js](backend/test/document-versioning.test.js) | Regression/infrastructure coverage; dedicated real PostgreSQL test remains gated. |
| [backend/test/infrastructure.test.js](backend/test/infrastructure.test.js) | Regression/infrastructure coverage; dedicated real PostgreSQL test remains gated. |
| [backend/test/postgres-integration.test.js](backend/test/postgres-integration.test.js) | Regression/infrastructure coverage; dedicated real PostgreSQL test remains gated. |
| [backend/test/startup-failures.test.js](backend/test/startup-failures.test.js) | Regression/infrastructure coverage; dedicated real PostgreSQL test remains gated. |
| [frontend/src/services/admin.service.js](frontend/src/services/admin.service.js) | Central API URL determines transitional Netlify versus external Express file routes. |
| [frontend/src/services/api.js](frontend/src/services/api.js) | Central API URL determines transitional Netlify versus external Express file routes. |
| [frontend/src/services/document.service.js](frontend/src/services/document.service.js) | Central API URL determines transitional Netlify versus external Express file routes. |
| [frontend/src/services/sheet.service.js](frontend/src/services/sheet.service.js) | Central API URL determines transitional Netlify versus external Express file routes. |
| [frontend/src/services/upload.service.js](frontend/src/services/upload.service.js) | Central API URL determines transitional Netlify versus external Express file routes. |
| [frontend/test/api-configuration.test.js](frontend/test/api-configuration.test.js) | Regression/infrastructure coverage; dedicated real PostgreSQL test remains gated. |
| [netlify.toml](netlify.toml) | Keep pg external to legacy ESM bundling; no site/deploy change executed. |
| [netlify/functions-src/api.mjs](netlify/functions-src/api.mjs) | Preserve transitional Function wrappers; safe errors and generic configuration bridge. |
| [netlify/functions-src/blob.mjs](netlify/functions-src/blob.mjs) | Preserve transitional Function wrappers; safe errors and generic configuration bridge. |
| [netlify/functions-src/legacyEnvironment.mjs](netlify/functions-src/legacyEnvironment.mjs) | Keep provider environment mapping isolated to the transitional Function wrapper. |
| [package-lock.json](package-lock.json) | Direct pg dependency, migration/transfer commands and external pg bundle option. |
| [package.json](package.json) | Direct pg dependency, migration/transfer commands and external pg bundle option. |
