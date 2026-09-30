import crypto from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.env.NODE_ENV !== 'production') {
  throw new Error('Production bootstrap requires NODE_ENV=production')
}

const databasePath = process.env.DATABASE_PATH?.trim()
if (!databasePath || !path.isAbsolute(databasePath)) {
  throw new Error('DATABASE_PATH must be an absolute persistent path')
}

// Render stops disk-backed services during deploys, so this captures the last
// stable SQLite file before importing the module that applies migrations.
if (existsSync(databasePath) && statSync(databasePath).size > 0) {
  copyFileSync(databasePath, `${databasePath}.predeploy-backup`)
  console.log('Created pre-deploy database backup')
}

process.env.SKIP_DB_SEED = '1'
const { db } = await import('./database.js')
const { importCourseWorkbook } = await import('./importCourseOfferings.js')
const registrarDirectory = fileURLToPath(new URL('../../data/registrar/', import.meta.url))

for (const program of ['CS', 'IT']) {
  const fileName = `DataCourse${program}.xlsx`
  const source = path.join(registrarDirectory, fileName)
  const fileHash = crypto.createHash('sha256').update(readFileSync(source)).digest('hex')
  const imported = db.prepare(`SELECT 1
    FROM course_imports imports
    JOIN programs ON programs.id=imports.program_id
    WHERE programs.code=? AND imports.file_hash=? AND imports.status='COMPLETED'
    LIMIT 1`).get(program, fileHash)
  if (!imported) {
    const result = await importCourseWorkbook(source, program, db, { fileName })
    console.log(`Imported ${program} reference data (${result.importedRows} rows)`)
  }
}

db.close()
console.log('Production database bootstrap complete')
