import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { validateLocalEphemeralStorageEnvironment } from '../src/services/ephemeralStorageSafety.js'

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

test('external storage verification is manual, pinned and local-ephemeral only', async () => {
  const workflow = await read('.github/workflows/external-storage-verification.yml')
  const integration = await read('backend/test/external-storage.application.integration.test.js')
  assert.match(workflow, /workflow_dispatch:/)
  assert.doesNotMatch(workflow, /\n[ ]{2}(?:push|pull_request):/)
  assert.match(workflow, /permissions:\s*\n\s+contents: read/)
  assert.match(workflow, /local_ephemeral_confirmation:/)
  assert.match(workflow, /EXTERNAL_STORAGE_TEST_MODE: local-ephemeral/)
  assert.match(workflow, /SUPABASE_STORAGE_PREFIX: phase7b\/\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/)
  assert.match(workflow, /supabase\/setup-cli@45a513f8c64c0bc8e0e3dfe572b5c95be85f6359/)
  assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/)
  assert.match(workflow, /actions\/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1/)
  assert.match(workflow, /actions\/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9/)
  assert.doesNotMatch(workflow, /uses:\s*[^\s]+@v\d/)
  assert.match(workflow, /version: 2\.121\.0/)
  assert.match(workflow, /^\s+supabase start\s*$/m)
  assert.doesNotMatch(workflow, /supabase start[^\r\n]*--runtime(?:\s|$)/)
  assert.match(workflow, /- name: Verify Docker daemon readiness/)
  assert.match(workflow, /for attempt in \{1\.\.10\}; do[\s\S]*docker info >\/dev\/null 2>&1[\s\S]*sleep 3[\s\S]*done/)
  assert.match(workflow, /supabase stop --no-backup/)
  assert.match(workflow, /phase7b1-ephemeral-storage-evidence/)
  assert.doesNotMatch(workflow, /\$\{\{\s*(?:secrets|vars)\./)
  assert.doesNotMatch(workflow, /TEST_SUPABASE|PRODUCTION_|SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(workflow, /supabase\s+(?:link|db push)/)
  assert.match(integration, /bucketMetadata\.public, false/)
  assert.match(integration, /databaseDialect, 'sqlite'/)
  assert.match(integration, /runScopedPrefix: true/)
  assert.match(integration, /Referenced cover assets must not be garbage-collected/)
  assert.match(integration, /A private object must not be readable without server credentials/)
  assert.match(integration, /Test object cleanup failed/)
  assert.doesNotMatch(integration, /console\.(?:log|info|error).*storageKey/)
})

test('local-ephemeral guard rejects hosted storage and inherited remote credentials', () => {
  const safe = {
    EXTERNAL_STORAGE_TEST_MODE: 'local-ephemeral', EXTERNAL_STORAGE_CREDENTIAL_SOURCE: 'supabase-local-status',
    EXTERNAL_STORAGE_RUN_ID: '123-1', NODE_ENV: 'test', DATABASE_DRIVER: 'sqlite', STORAGE_DRIVER: 'supabase',
    SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SECRET_KEY: 'local-fixture-key',
    SUPABASE_STORAGE_BUCKET: 'csit-sheet-phase7b-test', SUPABASE_STORAGE_PREFIX: 'phase7b/123-1'
  }
  assert.equal(validateLocalEphemeralStorageEnvironment(safe).storagePrefix, 'phase7b/123-1')
  assert.throws(() => validateLocalEphemeralStorageEnvironment({ ...safe, SUPABASE_URL: 'https://project.supabase.co' }), /loopback/)
  assert.throws(() => validateLocalEphemeralStorageEnvironment({ ...safe, DATABASE_URL: 'postgresql://production.invalid/app' }), /DATABASE_URL is prohibited/)
  assert.throws(() => validateLocalEphemeralStorageEnvironment({ ...safe, TEST_SUPABASE_SECRET_KEY: 'forbidden' }), /TEST_SUPABASE_SECRET_KEY is prohibited/)
  assert.throws(() => validateLocalEphemeralStorageEnvironment({ ...safe, SUPABASE_ACCESS_TOKEN: 'forbidden' }), /SUPABASE_ACCESS_TOKEN is prohibited/)
  assert.throws(() => validateLocalEphemeralStorageEnvironment({ ...safe, SUPABASE_STORAGE_BUCKET: 'documents' }), /test-named/)
  assert.throws(() => validateLocalEphemeralStorageEnvironment({ ...safe, SUPABASE_STORAGE_PREFIX: 'phase7b/another-run' }), /current Phase 7B run/)
})

test('staging example contains placeholders and no production endpoint or credential', async () => {
  const example = await read('config/staging.env.example')
  assert.match(example, /STAGING_SAFETY_TOKEN=ISOLATED-NON-PRODUCTION/)
  assert.match(example, /csit_sheet_staging/)
  assert.match(example, /example\.invalid/)
  assert.doesNotMatch(example, /mycsit-sheet-production|sb_secret_[A-Za-z0-9_-]{20,}/)
})
