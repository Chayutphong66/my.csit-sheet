import assert from 'node:assert/strict'
import test from 'node:test'
import { databaseDiagnosticCode, safeErrorDetails } from '../src/services/safeLogger.service.js'

test('safe error details redact connection strings, bearer tokens and configured secrets', () => {
  const previous = process.env.NETLIFY_DB_URL
  const previousSupabaseSecret = process.env.SUPABASE_SECRET_KEY
  process.env.NETLIFY_DB_URL = 'postgresql://private-user:private-password@example.invalid/database'
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_private-fixture'
  try {
    const error = new Error(`Connection failed for ${process.env.NETLIFY_DB_URL}; key=${process.env.SUPABASE_SECRET_KEY}; authorization=Bearer-private`)
    error.code = 'ECONNREFUSED'
    const details = safeErrorDetails(error)
    const serialized = JSON.stringify(details)
    assert.equal(details.code, 'ECONNREFUSED')
    assert.doesNotMatch(serialized, /private-user|private-password|private-fixture|Bearer-private/)
    assert.match(serialized, /REDACTED/)
  } finally {
    if (previous === undefined) delete process.env.NETLIFY_DB_URL
    else process.env.NETLIFY_DB_URL = previous
    if (previousSupabaseSecret === undefined) delete process.env.SUPABASE_SECRET_KEY
    else process.env.SUPABASE_SECRET_KEY = previousSupabaseSecret
  }
})

test('safe error details omit unsafe error codes', () => {
  const error = new Error('Database failed')
  error.code = 'unsafe value with spaces'
  assert.equal(safeErrorDetails(error).code, undefined)
})

test('database diagnostic codes expose categories instead of infrastructure details', () => {
  assert.equal(databaseDiagnosticCode({ name: 'MissingDatabaseConnectionError' }), 'DATABASE_CONFIGURATION_MISSING')
  assert.equal(databaseDiagnosticCode({ code: '42P01' }), 'DATABASE_SCHEMA_NOT_READY')
  assert.equal(databaseDiagnosticCode({ code: '28P01' }), 'DATABASE_AUTHENTICATION_FAILED')
  assert.equal(databaseDiagnosticCode(new Error('private infrastructure failure')), 'DATABASE_CHECK_FAILED')
})
