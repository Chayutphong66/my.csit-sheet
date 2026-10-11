import assert from 'node:assert/strict'
import test from 'node:test'
import { validateStagingEnvironment } from '../../scripts/phase7/staging-preflight.mjs'

function fixture(overrides = {}) {
  return {
    NODE_ENV: 'production', STAGING_SAFETY_TOKEN: 'ISOLATED-NON-PRODUCTION', STAGING_ENVIRONMENT_ID: 'csit-sheet-staging',
    DATABASE_DRIVER: 'postgres', DATABASE_URL: 'postgresql://user:password@db.internal/csit_sheet_staging?sslmode=require',
    STORAGE_DRIVER: 'supabase', SUPABASE_URL: 'https://staging-project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_staging_fixture',
    SUPABASE_STORAGE_BUCKET: 'csit-sheet-staging', JWT_SECRET: 'staging-only-secret-with-more-than-32-characters',
    APP_BASE_URL: 'https://staging.csit-sheet.test', ALLOWED_ORIGINS: 'https://staging.csit-sheet.test', COOKIE_SAME_SITE: 'strict',
    VITE_API_URL: '/api', ...overrides
  }
}

test('staging preflight accepts a separated production-mode contract without exposing secrets', () => {
  const result = validateStagingEnvironment(fixture())
  assert.equal(result.database.name, 'csit_sheet_staging')
  assert.equal(result.storage.bucket, 'csit-sheet-staging')
  assert.equal(JSON.stringify(result).includes('sb_secret'), false)
  assert.equal(result.application.cookieSecure, true)
})

test('staging preflight rejects production reuse and unsafe database/storage targets', () => {
  assert.throws(() => validateStagingEnvironment(fixture({ PRODUCTION_DATABASE_URL: fixture().DATABASE_URL })), /must differ/)
  assert.throws(() => validateStagingEnvironment(fixture({ DATABASE_URL: 'postgresql://user:password@db.internal/production' })), /name must contain/)
  assert.throws(() => validateStagingEnvironment(fixture({ SUPABASE_STORAGE_BUCKET: 'documents' })), /bucket must contain/)
  assert.throws(() => validateStagingEnvironment(fixture({ STAGING_SAFETY_TOKEN: '' })), /SAFETY_TOKEN/)
})
