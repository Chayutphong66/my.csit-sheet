export const PROGRAM_OPTIONS = Object.freeze([
  { value: 'CS', label: 'วิทยาการคอมพิวเตอร์ (CS)', name: 'วิทยาการคอมพิวเตอร์' },
  { value: 'IT', label: 'เทคโนโลยีสารสนเทศ (IT)', name: 'เทคโนโลยีสารสนเทศ' }
])

export const START_COHORT_BE_YEAR = 2566

export function currentBuddhistEraYear(date = new Date()) {
  return date.getFullYear() + 543
}

export function cohortOptions(date = new Date()) {
  const currentYear = currentBuddhistEraYear(date)
  if (currentYear < START_COHORT_BE_YEAR) return []
  return Array.from(
    { length: currentYear - START_COHORT_BE_YEAR + 1 },
    (_, index) => String((START_COHORT_BE_YEAR + index) % 100).padStart(2, '0')
  )
}

export function programName(program) {
  return PROGRAM_OPTIONS.find(option => option.value === program)?.name || ''
}
