# CSIT Sheet

CSIT Sheet is a Vue 3 and Express learning-material platform. The main user navigation is Home, Lectures, Sheets, Upload, and Profile. Authenticated users browse published files through Course → Academic Year → Semester, search globally or by structured document type, preview or download documents, submit Lecture or Sheet content from Upload, track their own requests, and view contribution statistics in Profile. Administrators inspect duplicate warnings, preview, approve, reject, reject as duplicate, or publish directly. SQLite stores workflow data and published file BLOBs in separate Lecture and Sheet file tables.

## Requirements

- Node.js 22.5 or newer (the backend uses `node:sqlite`)
- npm 10 or newer

## Local development

```bash
npm install
copy .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

The frontend runs at `http://127.0.0.1:5173`; Vite proxies `/api` to the backend at `http://127.0.0.1:8080`.

Development seed accounts:

- User: `user@csitsheet.app` / `User@1234`
- Admin: `admin@csitsheet.app` / `Admin@1234`

Normal production startup never inserts demo accounts. Run `db:seed` only for local/demo environments and never against a public production database.

## Commands

```bash
npm run db:migrate   # apply idempotent schema migrations
npm run db:seed      # add development seed data when tables are empty
npm test             # backend integration tests
npm run test:frontend # Vue component tests
npm run lint         # JavaScript and Vue lint checks
npm run build        # production Vue build
npm start            # start the API (and built frontend in production)
```

## Production deployment

The simplest deployment is one Node service with a persistent disk:

```bash
npm ci
npm run build
npm run db:migrate
NODE_ENV=production npm start
```

When `NODE_ENV=production`, Express serves `frontend/dist` and binds to `0.0.0.0` by default. Unknown frontend routes return the SPA entry point; unknown `/api/*` routes remain JSON 404 responses.

Configure these environment variables:

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
| `VITE_API_URL` | when frontend is separate | API base URL used at frontend build time. |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
```

Use HTTPS in production so secure refresh cookies work. Back up the SQLite database and place it on persistent storage. The current upload policy accepts PDF, Office documents, text, JPEG, and PNG files up to 20 MB decoded.

## Health check

`GET /api/health` returns:

```json
{ "status": "ok" }
```

## Architecture

```text
frontend/src/          Vue views, components, router, stores, API clients
backend/src/routes/    REST route definitions and authorization
backend/src/controllers/ request validation and HTTP responses
backend/src/repositories/ prepared SQLite data access
backend/src/data/      schema migration and development seed entry points
backend/test/          API integration tests
```

Published files live in `lecture_files` or `sheet_files`. Pending/rejected bytes remain private in `upload_requests`. Successful publication is transactional and clears the copied temporary BLOB.

`lectures` and `sheets` remain the publication source of truth. The Course hierarchy and search API use a read-only SQL union across those approved records; they do not create another document store. Academic years and semesters are derived from published data. Upload hashes are calculated server-side with SHA-256 and checked against both pending requests and published files.

## Security notes

Passwords are salted scrypt hashes. Access tokens are short-lived; opaque refresh tokens are hashed in SQLite, rotated, and delivered by httpOnly cookies. Protected APIs enforce authentication and role checks. Helmet, restricted CORS, login throttling, prepared SQL, upload validation, safe download headers, and production-safe error responses are enabled.

## Known limits

- SQLite BLOB storage is suitable for this project scale but should be reviewed before high-volume deployment.
- Profile field editing and full admin material CRUD are not currently product features.
- SQLite stores uploaded files in memory during API processing; review streaming/object storage before raising the 20 MB policy or scaling horizontally.
