import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')

test('PostgreSQL CI uses an ephemeral test database and verifies backup restore', async () => {
  const workflow = await read('.github/workflows/postgresql-integration.yml')
  assert.match(workflow, /image: postgres:16-alpine/)
  assert.match(workflow, /POSTGRES_DB: csit_sheet_test/)
  assert.match(workflow, /TEST_DATABASE_URL: postgresql:\/\/postgres:postgres@127\.0\.0\.1:5432\/csit_sheet_test/)
  assert.match(workflow, /npm run test:postgres/)
  assert.match(workflow, /pg_dump/)
  assert.match(workflow, /pg_restore/)
  assert.match(workflow, /npm run verify:postgres-restore/)
  assert.doesNotMatch(workflow, /secrets\.|production/i)
})

test('external storage verification is manual and accepts test-only secret names', async () => {
  const workflow = await read('.github/workflows/external-storage-verification.yml')
  assert.match(workflow, /workflow_dispatch:/)
  assert.doesNotMatch(workflow, /\n[ ]{2}(?:push|pull_request):/)
  assert.match(workflow, /environment: isolated-storage/)
  assert.match(workflow, /TEST_SUPABASE_URL: \$\{\{ secrets\.TEST_SUPABASE_URL \}\}/)
  assert.match(workflow, /TEST_SUPABASE_SECRET_KEY: \$\{\{ secrets\.TEST_SUPABASE_SECRET_KEY \}\}/)
  assert.match(workflow, /TEST_SUPABASE_STORAGE_BUCKET: \$\{\{ secrets\.TEST_SUPABASE_STORAGE_BUCKET \}\}/)
  assert.doesNotMatch(workflow, /PRODUCTION_|SUPABASE_SERVICE_ROLE_KEY/)
})

test('staging example contains placeholders and no production endpoint or credential', async () => {
  const example = await read('config/staging.env.example')
  assert.match(example, /STAGING_SAFETY_TOKEN=ISOLATED-NON-PRODUCTION/)
  assert.match(example, /csit_sheet_staging/)
  assert.match(example, /example\.invalid/)
  assert.doesNotMatch(example, /mycsit-sheet-production|sb_secret_[A-Za-z0-9_-]{20,}/)
})
