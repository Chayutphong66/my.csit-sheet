import assert from 'node:assert/strict'
import test from 'node:test'
import { safeErrorDetails } from '../src/services/safeLogger.service.js'

test('safe error details redact connection strings, bearer tokens and configured secrets', () => {
  const previous = process.env.NETLIFY_DB_URL
  process.env.NETLIFY_DB_URL = 'postgresql://private-user:private-password@example.invalid/database'
  try {
    const error = new Error(`Connection failed for ${process.env.NETLIFY_DB_URL}; authorization=Bearer-private`)
    error.code = 'ECONNREFUSED'
    const details = safeErrorDetails(error)
    const serialized = JSON.stringify(details)
    assert.equal(details.code, 'ECONNREFUSED')
    assert.doesNotMatch(serialized, /private-user|private-password|Bearer-private/)
    assert.match(serialized, /REDACTED/)
  } finally {
    if (previous === undefined) delete process.env.NETLIFY_DB_URL
    else process.env.NETLIFY_DB_URL = previous
  }
})

test('safe error details omit unsafe error codes', () => {
  const error = new Error('Database failed')
  error.code = 'unsafe value with spaces'
  assert.equal(safeErrorDetails(error).code, undefined)
})
