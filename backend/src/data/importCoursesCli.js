import { importHistoricalCourseData } from './importCourseOfferings.js'

const results = await importHistoricalCourseData(process.argv[2] ? { directory: process.argv[2] } : {})
for (const result of results) {
  console.log(`${result.program}: ${result.importedRows} rows, ${result.createdCourses} new courses, ${result.createdCourseOfferings} new offerings, ${result.createdTeachers} new teachers, ${result.createdTeacherAssignments} new assignments, ${result.skippedRows} skipped`)
}
