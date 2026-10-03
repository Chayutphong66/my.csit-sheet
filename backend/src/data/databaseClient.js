import { AsyncLocalStorage } from 'node:async_hooks'
import { logServerError } from '../services/safeLogger.service.js'

const transactionContext = new AsyncLocalStorage()
const isNetlifyRuntime = process.env.NETLIFY === 'true' || Boolean(
  process.env.NETLIFY_DB_URL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
)

let rootExecutor
let localDatabase
let netlifyDatabase

const initialization = (async () => {
  if (isNetlifyRuntime) {
    const { getDatabase } = await import('@netlify/database')
    netlifyDatabase = getDatabase()
    rootExecutor = {
      async query(sql, parameters = []) {
        const query = toPostgresQuery(sql, parameters)
        const result = await netlifyDatabase.pool.query(query.sql, query.parameters)
        return { ...result, rows: restoreAliases(result.rows, sql) }
      }
    }
  } else {
    const local = await import('./database.js')
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
    dialect: isNetlifyRuntime ? 'postgres' : 'sqlite',
    netlifyRuntime: isNetlifyRuntime
  })
  throw error
})

async function currentExecutor() {
  await initialization
  return transactionContext.getStore() || rootExecutor
}

function toPostgresSql(source) {
  let parameterIndex = 0
  let inString = false
  let sql = ''
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === "'") {
      sql += character
      if (inString && source[index + 1] === "'") {
        sql += source[index + 1]
        index += 1
      } else {
        inString = !inString
      }
    } else if (character === '?' && !inString) {
      parameterIndex += 1
      sql += `$${parameterIndex}`
    } else {
      sql += character
    }
  }
  sql = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')
  if (/^\s*INSERT\s+/i.test(sql) && /INSERT\s+OR\s+IGNORE/i.test(source) && !/ON\s+CONFLICT/i.test(sql)) {
    sql = `${sql.trim().replace(/;$/, '')} ON CONFLICT DO NOTHING`
  }
  return sql
    .replace(/\s+COLLATE\s+NOCASE/gi, '')
    .replace(/\bLIKE\b/gi, 'ILIKE')
    .replace(/group_concat\(([^,]+),\s*('[^']*')\)/gi, 'string_agg($1, $2)')
    .replace(/\bCURRENT_TIMESTAMP\b/gi, 'CURRENT_TIMESTAMP::text')
}

function toPostgresQuery(source, parameters) {
  if (parameters.length !== 1 || !parameters[0] || Array.isArray(parameters[0]) || typeof parameters[0] !== 'object') {
    return { sql: toPostgresSql(source), parameters }
  }
  const values = []
  const indexes = new Map()
  const sql = source.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name) => {
    if (!indexes.has(name)) {
      indexes.set(name, values.length + 1)
      values.push(parameters[0][name])
    }
    return `$${indexes.get(name)}`
  })
  return { sql: toPostgresSql(sql), parameters: values }
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
  await initialization
  if (!isNetlifyRuntime) {
    localDatabase.exec('BEGIN')
    try {
      const result = await transactionContext.run(rootExecutor, callback)
      localDatabase.exec('COMMIT')
      return result
    } catch (error) {
      localDatabase.exec('ROLLBACK')
      throw error
    }
  }

  const client = await netlifyDatabase.pool.connect()
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
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function checkDatabaseConnection() {
  try {
    await db.prepare('SELECT 1 AS ready').get()
    if (isNetlifyRuntime) {
      const rows = await db.prepare(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('users', 'refresh_tokens')
      `).all()
      const tables = new Set(rows.map((row) => row.table_name))
      const missing = ['users', 'refresh_tokens'].filter((table) => !tables.has(table))
      if (missing.length) {
        const error = new Error(`Required database tables are missing: ${missing.join(', ')}`)
        error.code = 'SCHEMA_NOT_READY'
        throw error
      }
    }
  } catch (error) {
    logServerError('database.health_check_failed', error, {
      dialect: isNetlifyRuntime ? 'postgres' : 'sqlite',
      netlifyRuntime: isNetlifyRuntime
    })
    throw error
  }
}

export const databaseDialect = isNetlifyRuntime ? 'postgres' : 'sqlite'
