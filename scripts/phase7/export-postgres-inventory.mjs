import pg from 'pg'
import { assertIsolatedPostgresUrl } from './postgres-test-safety.mjs'

const databaseUrl = process.env.TEST_DATABASE_URL
assertIsolatedPostgresUrl(databaseUrl, 'TEST_DATABASE_URL')
const client = new pg.Client({ connectionString: databaseUrl })
try {
  await client.connect()
  const ledger = (await client.query('SELECT name,checksum,applied_at FROM app_schema_migrations ORDER BY name')).rows
  const assets = (await client.query(`SELECT COUNT(*) assets,COALESCE(SUM(file_size),0) bytes,
    COUNT(*) FILTER (WHERE storage_key IS NOT NULL OR blob_key IS NOT NULL) external_references,
    COUNT(*) FILTER (WHERE file_data IS NOT NULL) database_payloads FROM file_assets`)).rows[0]
  const references = (await client.query(`SELECT
    (SELECT COUNT(*) FROM upload_requests WHERE file_asset_id IS NOT NULL) upload_requests,
    (SELECT COUNT(*) FROM lecture_files WHERE file_asset_id IS NOT NULL) lectures,
    (SELECT COUNT(*) FROM sheet_files WHERE file_asset_id IS NOT NULL) sheets,
    (SELECT COUNT(*) FROM document_versions WHERE file_asset_id IS NOT NULL) versions,
    (SELECT COUNT(*) FROM collections WHERE cover_file_asset_id IS NOT NULL) covers`)).rows[0]
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), ledger, storage: { assets, references } }, null, 2))
} finally {
  await client.end()
}
