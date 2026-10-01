# Netlify production deployment

Production is Netlify-only: the Vue build is static, the existing Express app runs through `netlify/functions/api.js`, Netlify Database stores relational records, and site-wide Netlify Blobs stores canonical file bytes and temporary upload chunks.

No database URL, Blob token, or signing secret belongs in Git. Netlify supplies `NETLIFY_DB_URL` and the Blobs runtime context to Functions.

## Environment variables

Set these in the Netlify UI for the production context:

| Variable | Required | Value |
| --- | --- | --- |
| `JWT_SECRET` | yes | A new random value of at least 32 bytes. |
| `NODE_ENV` | yes | `production` |
| `BOOTSTRAP_ADMIN_EMAIL` | temporarily | Email allowed to create the first admin while no admin exists; remove immediately afterward. |
| `ALLOWED_ORIGINS` | no | Extra HTTPS origins only; Netlify's site and deploy-preview origins are allowed automatically. |
| `ACCESS_TOKEN_TTL` | no | Defaults to `15m`. |
| `REFRESH_TOKEN_TTL_DAYS` | no | Defaults to `7`. |

Do not manually create or expose `NETLIFY_DB_URL`. Do not set `DATABASE_PATH` in production.

## Deploy

1. Connect this repository to the existing Netlify site.
2. Confirm Netlify Database and site-wide Blobs are enabled.
3. Add the environment variables above.
4. Deploy `main`. `netlify.toml` runs `npm ci && npm run build`, publishes `frontend/dist`, and deploys the API function and tracked database migration.
5. Register the account matching `BOOTSTRAP_ADMIN_EMAIL`, verify Admin access, then remove that variable and redeploy.
6. In Admin, preview and confirm the CS and IT registrar workbook imports.

The Thai hostname supplied during setup is a placeholder. Use the actual hostname shown in the Netlify site overview for production verification.

## Verification

- `GET /api/health` returns `{ "status": "ok", "database": "ready" }`.
- Registration, login, refresh, and logout work on the Netlify hostname.
- A file larger than 4.5 MB uploads through authenticated 2 MB chunks and remains downloadable after another deploy.
- Admin approval publishes exactly one Lecture or Sheet and its current version.
- Course imports and accounts remain after redeploying.
- One user cannot read or complete another user's upload session.

## Free-plan guardrail

This implementation does not require a paid service. Database, Functions, and Blobs consume the site's credit allowance. Monitor usage in Netlify. If Netlify rejects an operation because the Free-plan credit balance or another platform limit is reached, stop and record the exact limit/error before considering a plan change.

The 20 MB product upload limit remains. Chunks stay below the buffered Function request limit, and canonical objects stay well below the Blob object-size limit.

## Rollback

Publish a prior successful Netlify deploy to roll application code back. Database migrations are forward-only; do not edit or delete an applied migration. Site-wide Blob data is independent of individual deploys. Back up relational records and the Blob inventory before any destructive data operation.
