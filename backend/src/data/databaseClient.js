import { AsyncLocalStorage } from 'node:async_hooks'
import { logServerError } from '../services/safeLogger.service.js'
import { config } from '../config/environment.js'
import { toPostgresQuery } from './postgresSql.js'
import { verifySchema } from './schemaRequirements.js'

const transactionContext = new AsyncLocalStorage()
const isPostgres = config.databaseDriver === 'postgres'

let rootExecutor
let localDatabase
let pool
let sqliteTransactionTail = Promise.resolve()
let initialization
const localDatabaseModule = './database.js'

function initialize() {
  initialization ||= (async () => {
    if (isPostgres) {
      const { default: pg } = await import('pg')
      pool = new pg.Pool({ connectionString: config.databaseUrl, max: config.poolMax, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 })
      pool.on('error', error => logServerError('database.pool_error', error, { dialect: 'postgres' }))
      rootExecutor = {
        async query(sql, parameters = []) {
          const query = toPostgresQuery(sql, parameters)
          const result = await pool.query(query.sql, query.parameters)
          return { ...result, rows: restoreAliases(result.rows, sql) }
        }
      }
    } else {
      // SQLite is local-only and loaded on the first explicit database operation.
      const local = await import(localDatabaseModule)
      localDatabase = local.db
      rootExecutor = {
        async query(sql, parameters = [], mode = 'all') {
          const statement = localDatabase.prepare(sql)
          if (mode === 'run') {
            const result = statement.run(...parameters)
            return { rows: [], rowCount: Number(result.changes), changes: Number(result.changes) }
          }
          if (mode === 'get') {
            const row = statement.get(...parameters)
            return { rows: row ? [row] : [], rowCount: row ? 1 : 0 }
          }
          const rows = statement.all(...parameters)
          return { rows, rowCount: rows.length }
        }
      }
    }
  })().catch((error) => {
    logServerError('database.initialization_failed', error, {
      dialect: config.databaseDriver
    })
    throw error
  })
  return initialization
}

async function currentExecutor() {
  await initialize()
  const active = transactionContext.getStore()
  if (!active && !isPostgres) await sqliteTransactionTail
  return active || rootExecutor
}

function restoreAliases(rows, sourceSql) {
  const aliases = new Set(sourceSql.match(/\b[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*\b/g) || [])
  return rows.map((row) => {
    const restored = { ...row }
    for (const alias of aliases) {
      const postgresKey = alias.toLowerCase()
      if (!(alias in restored) && postgresKey in restored) restored[alias] = restored[postgresKey]
    }
    return restored
  })
}

function prepare(sql) {
  return {
    async get(...parameters) {
      const result = await (await currentExecutor()).query(sql, parameters, 'get')
      return result.rows[0]
    },
    async all(...parameters) {
      const result = await (await currentExecutor()).query(sql, parameters, 'all')
      return result.rows
    },
    async run(...parameters) {
      const result = await (await currentExecutor()).query(sql, parameters, 'run')
      const changes = Number(result.changes ?? result.rowCount ?? 0)
      return { changes }
    }
  }
}

export const db = { prepare }

export async function withTransaction(callback) {
  await initialize()
  if (transactionContext.getStore()) return callback()
  if (!isPostgres) {
    const previous = sqliteTransactionTail
    let release
    sqliteTransactionTail = new Promise(resolve => { release = resolve })
    await previous
    let began = false
    try {
      localDatabase.exec('BEGIN')
      began = true
      const result = await transactionContext.run(rootExecutor, callback)
      localDatabase.exec('COMMIT')
      return result
    } catch (error) {
      if (began) localDatabase.exec('ROLLBACK')
      throw error
    } finally { release() }
  }

  const client = await pool.connect()
  const executor = {
    async query(sql, parameters = []) {
      const query = toPostgresQuery(sql, parameters)
      const result = await client.query(query.sql, query.parameters)
      return { ...result, rows: restoreAliases(result.rows, sql) }
    }
  }
  try {
    await client.query('BEGIN')
    const result = await transactionContext.run(executor, callback)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try { await client.query('ROLLBACK') } catch (rollbackError) { logServerError('database.rollback_failed', rollbackError) }
    throw error
  } finally {
    client.release()
  }
}

export async function checkDatabaseConnection() {
  try {
    await db.prepare('SELECT 1 AS ready').get()
    if (isPostgres) {
      const rows = await db.prepare("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'").all()
      verifySchema(rows, config.storageDriver !== 'netlify')
    }
  } catch (error) {
    logServerError('database.health_check_failed', error, {
      dialect: config.databaseDriver
    })
    throw error
  }
}

export const databaseDialect = config.databaseDriver

export async function closeDatabase() {
  if (!initialization) return
  await initialization
  if (pool) await pool.end()
  else localDatabase.close()
}

export async function lockDocument(type, id) {
  if (!transactionContext.getStore()) throw new Error('Document locking requires a transaction')
  const table = type === 'Lecture' ? 'lectures' : type === 'Sheet' ? 'sheets' : null
  if (!table) throw new Error('Invalid document type')
  if (isPostgres) await db.prepare(`SELECT id FROM ${table} WHERE id = ? FOR UPDATE`).get(id)
}

export async function lockUploadRequest(id) {
  if (!transactionContext.getStore()) throw new Error('Upload locking requires a transaction')
  if (isPostgres) await db.prepare('SELECT id FROM upload_requests WHERE id=? FOR UPDATE').get(id)
}

export async function lockAssetHash(hash) {
  if (!transactionContext.getStore()) throw new Error('Asset locking requires a transaction')
  if (isPostgres) await db.prepare('SELECT pg_advisory_xact_lock(hashtextextended(?,0))').get(hash)
}
