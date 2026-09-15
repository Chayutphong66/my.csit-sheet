# CSIT Sheet

CSIT Sheet is a Thai-first Vue 3 and Express academic knowledge-sharing platform. The user navigation is หน้าหลัก, เอกสารการสอน, ชีทสรุป, อัปโหลด, and โปรไฟล์. Authenticated users browse Course → Academic Year → Semester, search documents and contributors from one place, open privacy-safe public profiles, preview/download documents, submit material, track requests, and see contributor impact. Public cards show clickable contributor identity, qualified Views/Downloads, and Helpful feedback. Admins work from an action-needed dashboard and focused approval workspace with exact/content/possible duplicate evidence.

SQLite stores one canonical `file_assets` BLOB per server-calculated SHA-256. Upload requests and public Lecture/Sheet file records use safe references to that asset.

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

The frontend runs at `http://127.0.0.1:5173`; Vite proxies `/api` to `http://127.0.0.1:8080`.

Development seed accounts:

- User: `user@csitsheet.app` / `User@1234`
- Admin: `admin@csitsheet.app` / `Admin@1234`

Production startup never inserts demo accounts. Run `db:seed` only for local/demo environments.

## Commands

```bash
npm run db:migrate        # apply idempotent schema migrations/backfill
npm run db:seed           # add development seed data when tables are empty
npm run db:storage-report # integrity and FileAsset/reference counts
npm run db:cleanup-files  # delete only unreferenced FileAssets
npm test                  # backend integration + frontend component tests
npm run test:backend
npm run test:frontend
npm run lint
npm run build
npm run start:production  # migrate, then serve API and built SPA
```

## Contributor rules

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

Canonical bytes live once in `file_assets`; requests and public file rows keep references. Publication is transactional and does not copy the BLOB. A database trigger blocks deletion of referenced assets, and `db:cleanup-files` removes only zero-reference rows.

## Production deployment

```bash
npm ci
npm run build
npm run db:migrate
NODE_ENV=production npm start
```

When `NODE_ENV=production`, Express serves `frontend/dist` and binds to `0.0.0.0` by default. Back up the SQLite database before migration and put it on persistent storage.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | yes | Set to `production`. |
| `JWT_SECRET` | yes | Long random signing secret; never commit it. |
| `DATABASE_PATH` | yes | Absolute path on persistent writable storage. |
| `ALLOWED_ORIGINS` | when frontend is separate | Comma-separated HTTPS frontend origins. |
| `PORT` | platform-dependent | HTTP port, default `8080`. |
| `HOST` | no | Bind host; production default is `0.0.0.0`. |
| `ACCESS_TOKEN_TTL` | no | Access JWT duration, default `15m`. |
| `REFRESH_TOKEN_TTL_DAYS` | no | Refresh session duration, default `7`. |
| `VITE_API_URL` | when frontend is separate | API base URL at frontend build time. |

`GET /api/health` returns `{ "status": "ok" }`.

## Security and limits

Passwords use salted scrypt hashes. JWT/rotated hashed refresh tokens, role and ownership checks, Helmet, restricted CORS, login throttling, prepared SQL, MIME/signature/size/filename validation, `nosniff`, and production-safe errors remain enabled. Pending/rejected files are never public interaction targets.

The 20 MB policy buffers files in memory, and SQLite BLOB storage is appropriate only for the current project scale. Reassess streaming/object storage before increasing upload size or scaling horizontally. Profile editing and full admin material deletion are not current features.
