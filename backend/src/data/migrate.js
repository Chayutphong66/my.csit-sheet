import pg from 'pg'
import { config } from '../config/environment.js'
import { applyPostgresMigrations } from './postgresMigrations.js'
import { logServerError } from '../services/safeLogger.service.js'

if (config.databaseDriver === 'sqlite') {
  process.env.SKIP_DB_SEED = '1'
  const { db } = await import('./database.js')
  db.close()
  console.info('Local SQLite schema initialization complete')
} else {
  const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 10000 })
  try {
    const applied = await applyPostgresMigrations(pool)
    console.info(JSON.stringify({ event: 'database.migrations_complete', applied }))
  } catch (error) {
    logServerError('database.migration_failed', error, { stage: 'migration' })
    process.exitCode = 1
  } finally { await pool.end() }
}
