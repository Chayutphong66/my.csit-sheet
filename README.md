# CSIT Sheet

CSIT Sheet is a Thai-first Vue 3 and Express academic knowledge-sharing platform. The user navigation is หน้าหลัก, เอกสารการสอน, ชีทสรุป, อัปโหลด, and โปรไฟล์. Authenticated users browse Course → Academic Year → Semester, search documents and contributors from one place, open privacy-safe public profiles, preview/download documents, submit material, track requests, and see contributor impact. Public cards show clickable contributor identity, qualified Views/Downloads, and Helpful feedback. Admins work from an action-needed dashboard and focused approval workspace with exact/content/possible duplicate evidence.

Local development uses SQLite with persistent FileAsset bytes. Phase 1 code preparation supports a future provider-neutral Express backend on Railway with PostgreSQL and Supabase Storage; it has not been deployed or connected to production. The existing Netlify Functions/Database/Blobs path is retained as transitional code. See [PHASE1_PREPARATION.md](PHASE1_PREPARATION.md) for configuration, migration safety, tests and remaining verification.

Upload metadata uses controlled CS/IT programs, Buddhist Era periods, synchronized Course Code/Name autocomplete, verified multi-select teachers, and an optional 1,000-character description. Course autocomplete is ranked locally and filtered by Program + year + semester; the Upload page never calls Reg8 or an AI service. Admins can approve a teacher suggestion globally, approve it only for one document, or reject it independently from document moderation.

Historical offerings come from the tracked `backend/data/registrar/DataCourseCS.xlsx` and `DataCourseIT.xlsx` files. Run `npm run db:migrate`, then `npm run db:import-courses`. The importer derives year and semester from worksheet names such as `2568_2`, reads the registrar's multi-row course/teacher layout, removes only the known `(CLOSE)` marker, and transactionally upserts Programs, Courses, ProgramCourse mappings, offerings, teachers, and assignments. Repeated imports are additive and idempotent. Admins can upload future workbooks from the Admin publish page, inspect the preview counts/errors, and explicitly confirm either a safe additive import or a separately confirmed destructive teacher sync. Every confirmed attempt is recorded in import history.

Public contributor APIs expose only display name, username, avatar, derived recognition, public aggregates, badges, and approved documents. Email, credentials, tokens, role, and private request states are excluded.

## Requirements

- Node.js 22.5 or newer (`node:sqlite` is required)
- npm 10 or newer

## Local development

```bash
npm install
copy .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

The backend does not automatically load the copied `.env`. Inject its variables into the shell or run `node --env-file=.env backend/src/server.js` from the repository root. Never use a production database for local tests.

The frontend runs at `http://127.0.0.1:5173`; Vite proxies `/api` to `http://127.0.0.1:8080`.

Development seed accounts:

- User: `user@csitsheet.app` / `User@1234`
- Admin: `admin@csitsheet.app` / `Admin@1234`

Production startup never inserts demo accounts. Run `db:seed` only for local/demo environments.

## Commands

```bash
npm run db:migrate        # selected-driver migration; explicit environment required
npm run db:transfer -- --source=<reviewed-sqlite-copy> # read-only dry-run by default
npm run db:seed           # add development seed data when tables are empty
npm run db:import-courses # import backend/data/registrar/DataCourse{CS,IT}.xlsx idempotently
npm run db:storage-report # integrity and FileAsset/reference counts
npm run db:cleanup-files  # delete only unreferenced FileAssets
npm test                  # backend integration + frontend component tests
npm run test:backend
npm run test:frontend
npm run test:visual        # isolated HTTPS/Edge screenshots + keyboard/CSP checks (after build)
npm run lint
npm run build
```

## Contributor rules

Visual QA uses a fresh temporary SQLite database, browser profile and local HTTPS certificate. Its sample actors/documents never enter the real database. On Windows it defaults to Microsoft Edge and Git's OpenSSL; other hosts can set `BROWSER_EXECUTABLE` and `OPENSSL_EXECUTABLE`. It requires Node with native WebSocket support, writes screenshots/report to `artifacts/visual-qa/`, and may need permission to run browser renderer processes outside a restricted sandbox. It does not install packages or change production security settings.

The design uses the supplied Starter Kit neutral palette, black actions and restrained purple with Thai typography. Starter includes a labelled concept demo, pauseable autonomous motion, static reduced-motion fallback, Bento capabilities and dark contribution storytelling. Authenticated metadata remains live; no fake Starter statistics are displayed.

Production preview uses `frame-src 'self' blob:`. Keep HTTPS and include the frontend's own origin in `ALLOWED_ORIGINS`, as built JS/CSS modules use crossorigin requests as well as the API.

Contribution Score is calculated dynamically from authoritative records:

- approved unique contribution: 20 points;
- qualified unique non-owner download: 2 points;
- active non-owner Helpful vote: 5 points;
- View: analytics only, no points.

Database uniqueness permits one qualified View/Download kind and one active Helpful vote per authenticated actor/document. Owner interactions are served but do not add impact or score. Levels and the small badge set are derived deterministically and grant no permissions. One upload-request row remains one contribution throughout review and publication.

## Duplicate and storage rules

The server calculates binary SHA-256 and compares both PENDING requests and APPROVED documents. Supported extractable plain text and simple text-based PDFs also receive a conservative NFKC/lowercase/whitespace-normalized content fingerprint. Unsupported, compressed, encrypted, image-only, malformed, or complex files fall back safely to exact and metadata checks.

- `EXACT_DUPLICATE`: binary hashes match, regardless of filename/type.
- `CONTENT_DUPLICATE`: binary differs but a high-confidence content hash matches.
- `POSSIBLE_DUPLICATE`: Course/year/semester/type/normalized title match only; admin must decide.

Canonical local bytes live in SQLite `file_assets`. Future production objects use the Supabase storage adapter; the existing Netlify Blob adapter remains transitional. Relational rows keep references and publication does not copy bytes. Cleanup removes only zero-reference DB assets and retains external objects to avoid concurrent shared-object deletion.

The upload form performs the same duplicate checks as a read-only preflight. Exact matches are stopped before a request is created; metadata/content matches show the existing canonical document and let the user open it, submit a revision, or explicitly continue with a new document.

## Document versions

Each approved Lecture or Sheet is one canonical document with an immutable version history. Existing public documents are backfilled as version 1 during `db:migrate` without copying their file bytes. Search and course pages continue to return one canonical result and the stable legacy document URL always serves its current approved version.

Authenticated users can propose a revision with a change type, summary, and file. A proposal remains private and does not change the public document until an admin approves it. Approval assigns the next sequential version and atomically moves the canonical current-version pointer; rejection preserves the proposal and review reason. Admin restore creates a new approved version referencing the selected historical asset, so history is never rewritten or deleted.

Approved non-initial revisions award the same 20 contribution points as an accepted original submission. Restores and duplicate bytes do not award points. Contributor profiles expose accepted revision activity, program/cohort metadata, and document-level contribution counts without exposing private account fields.

## Deployment

The production target is one Railway service: Express serves the built Vue SPA
and `/api` from the same HTTPS origin, backed by Supabase PostgreSQL and private
Supabase Storage. `VITE_API_URL=/api` is public build configuration; database,
JWT, and Supabase secret values remain backend-only. Production rejects SQLite
and local file storage instead of falling back.

PostgreSQL migrations are canonical in `backend/migrations/postgres/`. Railway
runs `npm run db:migrate` as a pre-deploy command; application startup checks
readiness without applying DDL. See [PHASE3_RAILWAY.md](PHASE3_RAILWAY.md) for
the exact service commands, variable names, health check, and release checklist.
The existing [DEPLOYMENT.md](DEPLOYMENT.md) remains the legacy Netlify runbook.
See [PHASE1_PREPARATION.md](PHASE1_PREPARATION.md) for the provider-neutral
configuration and transfer safety model.

`GET /api/health` returns 200 with `status: ok, database: ready`, or safe 503
dependency/schema categories without credentials, SQL or stack traces.

## Security and limits

Passwords use salted scrypt hashes. JWT/rotated hashed refresh tokens, role and ownership checks, Helmet, restricted CORS, login throttling, prepared SQL, MIME/signature/size/filename validation, `nosniff`, and production-safe errors remain enabled. Pending/rejected files are never public interaction targets.

The 20 MB policy and authenticated 2 MB upload chunks are preserved. Future production files belong in Supabase Storage, never the Railway filesystem. Full admin material deletion is not currently included.
