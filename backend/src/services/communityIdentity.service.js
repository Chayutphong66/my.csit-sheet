export const PROGRAMS = Object.freeze(['CS', 'IT'])
export const START_COHORT_BE_YEAR = 2566

export function currentBuddhistEraYear(date = new Date()) {
  return date.getFullYear() + 543
}

export function supportedCohorts(date = new Date()) {
  const currentYear = currentBuddhistEraYear(date)
  if (currentYear < START_COHORT_BE_YEAR) return []
  return Array.from(
    { length: currentYear - START_COHORT_BE_YEAR + 1 },
    (_, index) => String((START_COHORT_BE_YEAR + index) % 100).padStart(2, '0')
  )
}

export function normalizeProgram(value, { required = true } = {}) {
  const program = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (!program && !required) return ''
  if (!PROGRAMS.includes(program)) {
    const error = new Error('Program must be CS or IT')
    error.status = 400
    error.expose = true
    throw error
  }
  return program
}

export function normalizeCohort(value, { required = true, date = new Date() } = {}) {
  const cohort = typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
  if (!cohort && !required) return ''
  if (!/^\d{2}$/.test(cohort) || !supportedCohorts(date).includes(cohort)) {
    const error = new Error(`Cohort must be between 66 and ${supportedCohorts(date).at(-1) || '66'}`)
    error.status = 400
    error.expose = true
    throw error
  }
  return cohort
}

