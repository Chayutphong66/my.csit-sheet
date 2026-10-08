import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'

const TABLES = [
  'programs',
  'courses',
  'instructors',
  'program_courses',
  'course_offerings',
  'course_offering_teachers',
  'course_offering_programs'
]

const args = process.argv.slice(2)
const sourcePath = args.find(argument => argument.startsWith('--source='))?.slice(9)
if (!sourcePath) throw new Error('Provide --source=<SQLite file>')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')

const normalize = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('th-TH')
const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ')
const offeringKey = row => [row.course_id, row.academic_year, row.semester, row.section || ''].join('\u0000')
const pairKey = (left, right) => `${left}\u0000${right}`
const material = {
  programs: row => ({ code: row.code, name_th: row.name_th, name_en: row.name_en }),
  courses: row => ({ name: row.name, code: row.code || '', description: row.description || '', name_th: row.name_th || '', name_en: row.name_en || '', credits: row.credits === null ? null : Number(row.credits), category: row.category || '' }),
  instructors: row => ({ name: row.name, email: row.email || '', active: Number(row.active), normalized_name: row.normalized_name || normalize(row.name) }),
  course_offerings: row => ({ course_id: row.course_id, academic_year: row.academic_year, semester: row.semester, section: row.section || '', source_course_code: row.source_course_code || '', source_course_name: row.source_course_name || '' })
}
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const groupDuplicates = (rows, keyFor) => {
  const groups = new Map()
  for (const row of rows) {
    const key = keyFor(row)
    if (!key) continue
    const values = groups.get(key) || []
    values.push(row.id || row)
    groups.set(key, values)
  }
  return [...groups].filter(([, values]) => values.length > 1).map(([key, values]) => ({ key, count: values.length, ids: values.map(value => typeof value === 'object' ? value.id : value) }))
}
const indexBy = (rows, keyFor) => {
  const result = new Map()
  for (const row of rows) {
    const key = keyFor(row)
    if (!result.has(key)) result.set(key, [])
    result.get(key).push(row)
  }
  return result
}

const source = new DatabaseSync(sourcePath, { readOnly: true })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 })
let client

try {
  source.exec('BEGIN')
  const sourceRows = Object.fromEntries(TABLES.map(table => [table, source.prepare(`SELECT * FROM "${table}"`).all()]))
  client = await pool.connect()
  await client.query('BEGIN TRANSACTION READ ONLY')
  const targetRows = {}
  for (const table of TABLES) targetRows[table] = (await client.query(`SELECT * FROM "${table}"`)).rows

  const sourceCounts = Object.fromEntries(TABLES.map(table => [table, sourceRows[table].length]))
  const targetCounts = Object.fromEntries(TABLES.map(table => [table, targetRows[table].length]))
  sourceCounts.academic_years = new Set(sourceRows.course_offerings.map(row => row.academic_year)).size
  sourceCounts.semesters = new Set(sourceRows.course_offerings.map(row => row.semester)).size
  targetCounts.academic_years = new Set(targetRows.course_offerings.map(row => row.academic_year)).size
  targetCounts.semesters = new Set(targetRows.course_offerings.map(row => row.semester)).size

  const duplicates = {
    source: {
      courseCodes: groupDuplicates(sourceRows.courses.filter(row => clean(row.code)), row => clean(row.code).toLocaleUpperCase()),
      instructors: groupDuplicates(sourceRows.instructors, row => normalize(row.normalized_name || row.name)),
      courseOfferings: groupDuplicates(sourceRows.course_offerings, offeringKey)
    },
    target: {
      courseCodes: groupDuplicates(targetRows.courses.filter(row => clean(row.code)), row => clean(row.code).toLocaleUpperCase()),
      instructors: groupDuplicates(targetRows.instructors, row => normalize(row.normalized_name || row.name)),
      courseOfferings: groupDuplicates(targetRows.course_offerings, offeringKey)
    }
  }

  const conflicts = []
  const updates = []
  const primaryKeyConflicts = []
  const naturalKeyConflicts = []
  const mappings = { programs: {}, courses: {}, instructors: {}, course_offerings: {} }
  const action = Object.fromEntries(TABLES.map(table => [table, { insert: 0, reuse: 0, update: 0 }]))

  function mapEntities(table, sourceKey, targetKey) {
    const targetById = indexBy(targetRows[table], row => row.id)
    const targetByNatural = indexBy(targetRows[table], targetKey)
    for (const row of sourceRows[table]) {
      const natural = sourceKey(row)
      const idMatches = targetById.get(row.id) || []
      const naturalMatches = targetByNatural.get(natural) || []
      if (naturalMatches.length > 1) {
        naturalKeyConflicts.push({ table, sourceId: row.id, naturalKey: natural, targetIds: naturalMatches.map(match => match.id), reason: 'multiple target rows match natural key' })
        continue
      }
      let target = naturalMatches[0]
      if (!target && idMatches.length) {
        const candidateKey = targetKey(idMatches[0])
        if (candidateKey !== natural) {
          primaryKeyConflicts.push({ table, sourceId: row.id, sourceNaturalKey: natural, targetNaturalKey: candidateKey, reason: 'source ID is occupied by a different target record' })
          continue
        }
        target = idMatches[0]
      }
      if (!target) {
        mappings[table][row.id] = row.id
        action[table].insert++
        continue
      }
      mappings[table][row.id] = target.id
      if (target.id === row.id && !equal(material[table](row), material[table](target))) {
        primaryKeyConflicts.push({ table, sourceId: row.id, naturalKey: natural, reason: 'same ID and natural key but material values differ' })
      }
      const sourceValue = material[table](row)
      const targetValue = material[table](target)
      if (equal(sourceValue, targetValue)) action[table].reuse++
      else {
        action[table].update++
        updates.push({ table, sourceId: row.id, targetId: target.id, naturalKey: natural, source: sourceValue, target: targetValue })
      }
    }
  }

  mapEntities('programs', row => clean(row.code).toLocaleUpperCase(), row => clean(row.code).toLocaleUpperCase())
  mapEntities('courses', row => clean(row.code) ? `code:${clean(row.code).toLocaleUpperCase()}` : `id:${row.id}`, row => clean(row.code) ? `code:${clean(row.code).toLocaleUpperCase()}` : `id:${row.id}`)
  mapEntities('instructors', row => normalize(row.normalized_name || row.name), row => normalize(row.normalized_name || row.name))

  const mappedSourceOfferings = sourceRows.course_offerings.map(row => ({ ...row, course_id: mappings.courses[row.course_id] }))
  const targetOfferingsById = indexBy(targetRows.course_offerings, row => row.id)
  const targetOfferingsByNatural = indexBy(targetRows.course_offerings, offeringKey)
  for (let index = 0; index < sourceRows.course_offerings.length; index++) {
    const original = sourceRows.course_offerings[index]
    const row = mappedSourceOfferings[index]
    if (!row.course_id) {
      conflicts.push({ table: 'course_offerings', sourceId: original.id, reason: 'parent course has no deterministic target mapping' })
      continue
    }
    const natural = offeringKey(row)
    const naturalMatches = targetOfferingsByNatural.get(natural) || []
    if (naturalMatches.length > 1) {
      naturalKeyConflicts.push({ table: 'course_offerings', sourceId: original.id, naturalKey: natural, targetIds: naturalMatches.map(match => match.id), reason: 'multiple target rows match natural key' })
      continue
    }
    let target = naturalMatches[0]
    const idMatch = (targetOfferingsById.get(original.id) || [])[0]
    if (!target && idMatch) {
      if (offeringKey(idMatch) !== natural) {
        primaryKeyConflicts.push({ table: 'course_offerings', sourceId: original.id, sourceNaturalKey: natural, targetNaturalKey: offeringKey(idMatch), reason: 'source ID is occupied by a different target offering' })
        continue
      }
      target = idMatch
    }
    if (!target) {
      mappings.course_offerings[original.id] = original.id
      action.course_offerings.insert++
      continue
    }
    mappings.course_offerings[original.id] = target.id
    const sourceValue = material.course_offerings(row)
    const targetValue = material.course_offerings(target)
    if (equal(sourceValue, targetValue)) action.course_offerings.reuse++
    else {
      action.course_offerings.update++
      updates.push({ table: 'course_offerings', sourceId: original.id, targetId: target.id, naturalKey: natural, source: sourceValue, target: targetValue })
    }
  }

  function mapLinks(table, leftColumn, rightColumn, leftMappings, rightMappings) {
    const existing = new Set(targetRows[table].map(row => pairKey(row[leftColumn], row[rightColumn])))
    for (const row of sourceRows[table]) {
      const left = leftMappings[row[leftColumn]]
      const right = rightMappings[row[rightColumn]]
      if (!left || !right) {
        conflicts.push({ table, sourceKey: pairKey(row[leftColumn], row[rightColumn]), reason: 'parent row has no deterministic target mapping' })
        continue
      }
      if (existing.has(pairKey(left, right))) action[table].reuse++
      else action[table].insert++
    }
  }
  mapLinks('program_courses', 'program_id', 'course_id', mappings.programs, mappings.courses)
  mapLinks('course_offering_teachers', 'offering_id', 'teacher_id', mappings.course_offerings, mappings.instructors)
  mapLinks('course_offering_programs', 'offering_id', 'program_id', mappings.course_offerings, mappings.programs)

  const sourceIdReuse = Object.fromEntries(Object.entries(mappings).map(([table, values]) => [table, {
    preserved: Object.entries(values).filter(([sourceId, targetId]) => sourceId === targetId).length,
    remapped: Object.entries(values).filter(([sourceId, targetId]) => sourceId !== targetId).length
  }]))
  const mappingDetails = Object.fromEntries(Object.entries(mappings).map(([table, values]) => [table, Object.entries(values).filter(([sourceId, targetId]) => sourceId !== targetId).map(([sourceId, targetId]) => ({ sourceId, targetId }))]))
  const duplicateConflicts = Object.entries(duplicates).flatMap(([side, sets]) => Object.entries(sets).flatMap(([kind, rows]) => rows.map(row => ({ side, kind, ...row }))))
  conflicts.push(...primaryKeyConflicts, ...naturalKeyConflicts, ...duplicateConflicts)

  console.log(JSON.stringify({
    mode: 'REFERENCE DATA PRE-APPLY READ ONLY',
    sourcePath,
    sourceCounts,
    targetCounts,
    primaryKeyConflicts,
    naturalKeyConflicts,
    duplicates,
    actions: action,
    updates,
    idMapping: { strategy: 'Preserve source IDs for inserts; reuse target IDs for natural-key matches; transform all relationship foreign keys through the mapping.', summary: sourceIdReuse, remapped: mappingDetails },
    conflicts,
    safeAndDeterministic: conflicts.length === 0
  }, null, 2))
  await client.query('ROLLBACK')
} catch (error) {
  if (client) {
    try { await client.query('ROLLBACK') } catch (rollbackError) { void rollbackError }
  }
  throw error
} finally {
  client?.release()
  await pool.end()
  source.close()
}
