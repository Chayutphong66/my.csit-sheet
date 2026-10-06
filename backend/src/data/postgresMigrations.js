import crypto from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const migrationDirectory = fileURLToPath(new URL('../../migrations/postgres/', import.meta.url))
const LOCK_ID = 734619205

export async function applyPostgresMigrations(pool, directory = migrationDirectory) {
  const names = (await readdir(directory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort()
  const migrations = await Promise.all(names.map(async name => {
    const sql = (await readFile(`${directory}/${name}`, 'utf8')).replaceAll('\r\n', '\n')
    return { name, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') }
  }))
  const client = await pool.connect()
  let locked = false
  const applied = []
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID])
    locked = true
    await client.query(`CREATE TABLE IF NOT EXISTS app_schema_migrations (
      name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
    const history = (await client.query('SELECT name, checksum FROM app_schema_migrations ORDER BY name')).rows
    for (const previous of history) {
      const current = migrations.find(migration => migration.name === previous.name)
      if (!current || current.checksum !== previous.checksum) throw new Error('Applied migration history differs from canonical files')
    }
    for (const migration of migrations) {
      if (history.some(previous => previous.name === migration.name)) continue
      if (history.some(previous => previous.name > migration.name)) throw new Error('New migration is out of order')
      await client.query('BEGIN')
      try {
        await client.query("SET LOCAL TIME ZONE 'UTC'")
        await client.query(migration.sql)
        await client.query('INSERT INTO app_schema_migrations(name,checksum) VALUES($1,$2)', [migration.name, migration.checksum])
        await client.query('COMMIT')
        applied.push(migration.name)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
    return applied
  } finally {
    try { if (locked) await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]) }
    finally { client.release() }
  }
}
