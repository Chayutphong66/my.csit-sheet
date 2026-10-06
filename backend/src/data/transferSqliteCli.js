import pg from 'pg'
import { transferSqlite } from './sqliteTransfer.js'
import { logServerError } from '../services/safeLogger.service.js'

const args = process.argv.slice(2)
const source = args.find(arg => arg.startsWith('--source='))?.slice(9)
const apply = args.includes('--apply')
let pool
try {
  if (!source) throw new Error('Provide --source=<SQLite file>; default mode is dry-run')
  if (apply) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for explicit apply')
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 })
  }
  const report = await transferSqlite(source, pool, { apply, demoPolicy: args.find(arg => arg.startsWith('--demo-policy='))?.slice(14) })
  console.info(JSON.stringify(report, null, 2))
  if (!report.ready) process.exitCode = 1
} catch (error) {
  logServerError('database.transfer_failed', error)
  process.exitCode = 1
} finally { if (pool) await pool.end() }
