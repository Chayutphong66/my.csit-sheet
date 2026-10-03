import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')

test('Netlify configuration builds the SPA and rewrites API traffic to the function', () => {
  const config = readFileSync(path.join(root, 'netlify.toml'), 'utf8')
  assert.match(config, /publish = "frontend\/dist"/)
  assert.match(config, /functions = "netlify\/functions"/)
  assert.match(config, /included_files = \[[^\]]*"backend\/data\/registrar\/\*\*"/)
  assert.match(config, /from = "\/api\/\*"[\s\S]*to = "\/\.netlify\/functions\/api\/:splat"/)
  assert.doesNotMatch(config, /DATABASE_URL|NETLIFY_DB_URL|JWT_SECRET/)
})

test('production schema stores Blob keys and never seeds users', () => {
  const migration = readFileSync(path.join(root, 'netlify/database/migrations/20261002000000_initial_schema/migration.sql'), 'utf8')
  assert.match(migration, /CREATE TABLE file_assets[\s\S]*blob_key TEXT NOT NULL/)
  assert.match(migration, /file_data BYTEA/)
  assert.match(migration, /INSERT INTO programs/)
  assert.doesNotMatch(migration, /INSERT INTO users/)
})

test('Netlify Function delegates to the existing Express application', () => {
  const entry = readFileSync(path.join(root, 'netlify/functions-src/api.cjs'), 'utf8')
  assert.match(entry, /serverless-http/)
  assert.match(entry, /backend\/src\/app\.js/)
})
