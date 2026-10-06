import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { verifySchema } from './schemaRequirements.js'

const schema = readFileSync(fileURLToPath(new URL('../../migrations/postgres/001_initial_schema.sql', import.meta.url)), 'utf8')
export const transferTables = [...schema.matchAll(/CREATE TABLE (\w+) \(/g)].map(match => match[1])
const canonicalColumns = new Map([...schema.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g)].map(match => [match[1], new Set([...match[2].matchAll(/\b(\w+)\s+(?:TEXT|INTEGER|BYTEA)\b/g)].map(column => column[1]))]))
canonicalColumns.get('file_assets').add('storage_key').add('storage_provider')

function inspectSource(source) {
  const integrity = source.prepare('PRAGMA integrity_check').get().integrity_check
  const violations = source.prepare('PRAGMA foreign_key_check').all()
  const issues = violations.map(() => 'Foreign key violation in source')
  if (integrity !== 'ok') issues.push('SQLite integrity check failed')
  const tables = {}
  const present = new Set(source.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name))
  for (const table of present) {
    if (!transferTables.includes(table) && !table.startsWith('sqlite_')) issues.push(`Unsupported source table requires a policy: ${table}`)
  }
  const schemaRows = [...present].flatMap(table => source.prepare(`PRAGMA table_info("${table.replaceAll('"', '""')}")`).all().map(column => ({ table_name: table, column_name: column.name })))
  try { verifySchema(schemaRows, false) } catch (error) { issues.push(error.message) }
  for (const name of transferTables) {
    if (!present.has(name)) { issues.push(`Required source table missing: ${name}`); continue }
    tables[name] = Number(source.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get().count)
    const columns = source.prepare(`PRAGMA table_info("${name}")`).all()
    if (columns.some(column => !canonicalColumns.get(name).has(column.name))) issues.push(`Unsupported source columns in ${name}; apply cannot silently skip them`)
    const primary = columns.filter(column => column.pk).map(column => `"${column.name}"`).join(',')
    if (primary && source.prepare(`SELECT 1 FROM "${name}" GROUP BY ${primary} HAVING COUNT(*)>1 LIMIT 1`).get()) issues.push(`Duplicate key in ${name}`)
    for (const column of columns.filter(column => column.notnull)) {
      if (source.prepare(`SELECT 1 FROM "${name}" WHERE "${column.name}" IS NULL LIMIT 1`).get()) issues.push(`Required NULL in ${name}.${column.name}`)
    }
  }
  const users = present.has('users') ? source.prepare('SELECT id,username,password FROM users').all() : []
  if (users.some(user => !/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(String(user.password)))) issues.push('Source contains passwords that are not supported hashes; apply is blocked')
  const demoAccounts = users.filter(user => /^(admin[0-9]*|user[0-9]+|demo.*|test.*|dbcheck.*|deploy.*)$/i.test(user.username)).map(user => ({ id: user.id, username: user.username }))
  if (present.has('file_assets')) {
    for (const asset of source.prepare('SELECT id,binary_hash,file_data,file_size FROM file_assets').all()) {
      if (!asset.file_data?.length) { issues.push(`Asset requires external content inspection: ${asset.id}`); continue }
      if (crypto.createHash('sha256').update(Buffer.from(asset.file_data)).digest('hex') !== asset.binary_hash || asset.file_data.length !== asset.file_size) issues.push(`Asset hash/size mismatch: ${asset.id}`)
    }
  }
  if (present.has('document_versions') && present.has('lectures') && present.has('sheets')) {
    for (const [type, table] of [['Lecture', 'lectures'], ['Sheet', 'sheets']]) {
      for (const reference of ['document_versions', 'document_stars', 'document_interactions', 'document_helpful_votes', 'document_teachers']) {
        if (!present.has(reference)) continue
        if (source.prepare(`SELECT 1 FROM "${reference}" r WHERE r.document_type=? AND NOT EXISTS(SELECT 1 FROM "${table}" d WHERE d.id=r.document_id) LIMIT 1`).get(type)) issues.push(`Orphan document reference in ${reference}`)
      }
      if (source.prepare(`SELECT 1 FROM "${table}" d WHERE d.current_version_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM document_versions v WHERE v.id=d.current_version_id AND v.document_id=d.id AND v.document_type=? AND v.status='APPROVED') LIMIT 1`).get(type)) issues.push(`Invalid current version in ${table}`)
    }
    if (present.has('file_assets') && source.prepare('SELECT 1 FROM document_versions v JOIN file_assets a ON a.id=v.file_asset_id WHERE v.sha256!=a.binary_hash OR v.file_size!=a.file_size LIMIT 1').get()) issues.push('Version asset hash/reference mismatch')
  }
  return { mode: 'DRY RUN', sourceUnmodified: true, integrity, tables, foreignKeyViolations: violations.length, demoAccounts, issues, ready: !issues.length }
}

export function inspectSqlite(sourcePath) {
  const source = new DatabaseSync(sourcePath, { readOnly: true })
  try {
    source.exec('BEGIN')
    return inspectSource(source)
  } finally { source.close() }
}

export async function transferSqlite(sourcePath, pool, { apply = false, demoPolicy } = {}) {
  if (!apply) return inspectSqlite(sourcePath)
  const source = new DatabaseSync(sourcePath, { readOnly: true })
  let client
  try {
    source.exec('BEGIN')
    const report = inspectSource(source)
    if (!report.ready) throw new Error('Source validation failed; no target writes performed')
    if (demoPolicy !== 'include') throw new Error('Explicit demo policy "include" is required; account exclusion requires a reviewed dependency policy')
    client = await pool.connect()
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [734619206])
    const targetCounts = {}
    for (const name of transferTables) {
      const count = Number((await client.query(`SELECT COUNT(*) count FROM "${name}"`)).rows[0].count)
      if (name === 'programs' && count) {
        const programs = (await client.query('SELECT * FROM programs')).rows
        const seeds = { 'program-cs': ['CS', 'Computer Science', 'วิทยาการคอมพิวเตอร์'], 'program-it': ['IT', 'Information Technology', 'เทคโนโลยีสารสนเทศ'] }
        if (count !== 2 || programs.some(row => !seeds[row.id] || row.code !== seeds[row.id][0] || row.name_en !== seeds[row.id][1] || row.name_th !== seeds[row.id][2])) throw new Error('Target programs are not untouched canonical seeds')
        if (programs.some(row => !source.prepare('SELECT 1 FROM programs WHERE id=? AND code=?').get(row.id, row.code))) throw new Error('Source programs differ from canonical seed identities')
      } else if (count) throw new Error('Transfer requires an empty, migrated target; merge policy is not implemented')
    }
    for (const name of transferTables) {
      const targetColumns = new Set((await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2', ['public', name])).rows.map(row => row.column_name))
      const columns = source.prepare(`PRAGMA table_info("${name}")`).all().map(column => column.name)
      if (columns.some(column => !/^[a-z_][a-z0-9_]*$/.test(column) || !targetColumns.has(column))) throw new Error(`Target schema cannot preserve all columns in ${name}`)
      const rows = source.prepare(`SELECT * FROM "${name}"`).all()
      for (const row of rows) {
        const values = columns.map(column => row[column] instanceof Uint8Array ? Buffer.from(row[column]) : row[column])
        const preservePrograms = name === 'programs' ? ' ON CONFLICT (id) DO UPDATE SET name_th=EXCLUDED.name_th,name_en=EXCLUDED.name_en' : ''
        await client.query(`INSERT INTO "${name}" (${columns.map(column => `"${column}"`).join(',')}) VALUES (${columns.map((_column, index) => `$${index + 1}`).join(',')})${preservePrograms}`, values)
      }
      targetCounts[name] = Number((await client.query(`SELECT COUNT(*) count FROM "${name}"`)).rows[0].count)
      if (targetCounts[name] !== report.tables[name]) throw new Error(`Row count mismatch: ${name}`)
      const fingerprint = row => crypto.createHash('sha256').update(JSON.stringify(columns.map(column => row[column] instanceof Uint8Array ? { bytes: Buffer.from(row[column]).toString('base64') } : row[column]))).digest('hex')
      const targetRows = (await client.query(`SELECT ${columns.map(column => `"${column}"`).join(',')} FROM "${name}"`)).rows
      const expected = rows.map(fingerprint).sort()
      const actual = targetRows.map(fingerprint).sort()
      if (expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) throw new Error(`Transferred data verification failed: ${name}`)
    }
    // DB foreign keys validate references; compare persisted hashes without printing them.
    for (const table of ['users', 'file_assets']) {
      const column = table === 'users' ? 'password' : 'binary_hash'
      const expected = new Map(source.prepare(`SELECT id,"${column}" FROM "${table}"`).all().map(row => [row.id, row[column]]))
      for (const row of (await client.query(`SELECT id,"${column}" FROM "${table}"`)).rows) {
        if (expected.get(row.id) !== row[column]) throw new Error('Transferred hash verification failed')
      }
    }
    await client.query('COMMIT')
    return { ...report, mode: 'APPLY', targetCounts }
  } catch (error) {
    if (client) await client.query('ROLLBACK')
    throw error
  } finally { client?.release(); source.close() }
}
