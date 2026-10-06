# Phase 3: Railway single-service deployment

The production target is one Railway service. Railpack installs the npm
workspaces, Vite builds `frontend/dist`, and the Express process serves both the
Vue application and `/api`. Supabase remains the external PostgreSQL database
and private object store. The transitional Netlify files remain in the
repository but are not used by this Railway service.

## Railway service settings

Connect the GitHub repository `Chayutphong66/my.csit-sheet`, deploy branch
`main`, and leave the root directory at the repository root.

| Setting | Value |
| --- | --- |
| Builder | Railpack |
| Build command | `npm run build:railway` |
| Pre-deploy command | `npm run db:migrate` |
| Start command | `npm start` |
| Healthcheck path | `/api/health` |
| Healthcheck timeout | 300 seconds |
| Restart policy | On Failure (maximum 3 retries) |

Railway supplies `PORT`; do not set a fixed production port. The repository
pins the runtime to Node `>=22.5.0 <23` so deployment stays on the tested Node 22
major. The pre-deploy migration is the only automated production migration
entry point. Application startup checks schema readiness but never creates,
drops, truncates, resets, or migrates tables.

The initial deployment may omit `ALLOWED_ORIGINS` while no public domain exists.
In that bootstrap state the server can answer platform health checks, but rejects
every request carrying a cross-origin `Origin` header. Once Railway generates a
public domain, its platform-provided `RAILWAY_PUBLIC_DOMAIN` is converted to one
exact HTTPS allowed origin automatically. An explicit `ALLOWED_ORIGINS` remains
supported and takes precedence; it must contain exact HTTPS origins with no path
or trailing slash. Keep `VITE_API_URL=/api` so browser API and refresh-cookie
requests remain same-origin.

## Environment variable names

Secret values belong only in Railway Variables and must never be pasted into
source, logs, build arguments, or `VITE_*` variables.

### Secret

- `DATABASE_URL`
- `JWT_SECRET`
- `SUPABASE_SECRET_KEY`

### Non-secret

- `NODE_ENV=production`
- `DATABASE_DRIVER=postgres`
- `DATABASE_POOL_MAX=5`
- `STORAGE_DRIVER=supabase`
- `SUPABASE_URL`
- `SUPABASE_STORAGE_BUCKET=documents`
- `ALLOWED_ORIGINS` (optional explicit override after a domain exists)
- `COOKIE_SAME_SITE=lax`
- `ACCESS_TOKEN_TTL=15m`
- `REFRESH_TOKEN_TTL_DAYS=7`
- `VITE_API_URL=/api`

`PORT` is platform-managed and `HOST` defaults to `0.0.0.0` in production.
`DATABASE_PATH`, `SUPABASE_SERVICE_ROLE_KEY`, and Netlify variables are not part
of the Railway service configuration.

## Release checks

Before public acceptance testing, confirm the pre-deploy log reports zero
pending migrations (or only the expected canonical files on the first release),
the deployment becomes healthy, and `GET /api/health` returns HTTP 200 with
`{"status":"ok","database":"ready"}`. Test direct navigation to `/`,
`/register`, an authenticated application route, and an unknown Vue route.
Confirm `/api/nonexistent` remains a JSON 404 rather than returning `index.html`.

Then run the approved production smoke test in order: register a disposable
account, login, refresh, logout, authenticated navigation, one tiny upload,
admin approval, download/view, star, contribution/achievement checks, and
version-history/revision checks. Remove disposable records and objects after
verification. Do not run the real SQLite-to-PostgreSQL transfer without a new,
explicit owner approval.
