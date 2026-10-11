import pg from 'pg'
import { assertIsolatedPostgresUrl } from './postgres-test-safety.mjs'

const sourceUrl = process.env.TEST_DATABASE_URL
const restoreUrl = process.env.TEST_RESTORE_DATABASE_URL
assertIsolatedPostgresUrl(sourceUrl, 'TEST_DATABASE_URL')
assertIsolatedPostgresUrl(restoreUrl, 'TEST_RESTORE_DATABASE_URL')
if (sourceUrl === restoreUrl) throw new Error('Restore verification requires a different database')

const source = new pg.Client({ connectionString: sourceUrl })
const restored = new pg.Client({ connectionString: restoreUrl })
try {
  await Promise.all([source.connect(), restored.connect()])
  const ledgerSql = 'SELECT name,checksum FROM app_schema_migrations ORDER BY name'
  const [sourceLedger, restoredLedger] = await Promise.all([source.query(ledgerSql), restored.query(ledgerSql)])
  if (JSON.stringify(sourceLedger.rows) !== JSON.stringify(restoredLedger.rows)) throw new Error('Restored migration ledger differs from source')
  const tables = (await source.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(row => row.table_name)
  const restoredTables = (await restored.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(row => row.table_name)
  if (JSON.stringify(tables) !== JSON.stringify(restoredTables)) throw new Error('Restored table set differs from source')
  for (const table of tables) {
    if (!/^[a-z_]+$/.test(table)) throw new Error('Unsafe table identifier in restore verification')
    const [before, after] = await Promise.all([source.query(`SELECT COUNT(*) count FROM ${table}`), restored.query(`SELECT COUNT(*) count FROM ${table}`)])
    if (before.rows[0].count !== after.rows[0].count) throw new Error(`Restored row count differs for ${table}`)
  }
  console.log(JSON.stringify({ status: 'ok', migrations: sourceLedger.rowCount, tables: tables.length }))
} finally {
  await Promise.allSettled([source.end(), restored.end()])
}
