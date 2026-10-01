import { getCurriculumCourse, listAcademicPeriods, listPrograms, searchCourses, teachersForCourse, createTeacherSuggestion } from '../repositories/academic.repository.js'
import { academicYear, semester, section, teacherName, validationError } from '../services/academicValidation.service.js'
import { notifyAdmins } from '../repositories/notification.repository.js'

export async function courses(req, res) { res.json({ courses: await searchCourses({ query: String(req.query.q ?? req.query.search ?? '').slice(0, 100), program: String(req.query.program ?? ''), academicYear: String(req.query.year ?? ''), semester: String(req.query.semester ?? ''), limit: req.query.limit }) }) }
export async function programs(_req, res) { res.json({ programs: await listPrograms() }) }
export async function periods(_req, res) { res.json(await listAcademicPeriods()) }
export async function courseTeachers(req, res, next) {
  try {
    if (!await getCurriculumCourse(req.params.id)) throw validationError('Course not found', 404)
    const year = academicYear(req.query.year); const term = semester(req.query.semester)
    res.json({ teachers: await teachersForCourse(req.params.id, year, term, req.query.section === undefined ? undefined : section(req.query.section), String(req.query.program ?? '')) })
  } catch (error) { next(error) }
}
export async function suggestTeacher(req, res, next) {
  try {
    const value = await createTeacherSuggestion({ teacherName: teacherName(req.body.teacherName), courseId: String(req.body.courseId ?? ''), academicYear: academicYear(req.body.academicYear), semester: semester(req.body.semester), section: section(req.body.section), note: String(req.body.note ?? '').slice(0, 1000), userId: req.user.id })
    if (value === false) throw validationError('มีคำแนะนำอาจารย์รายการนี้รอตรวจสอบอยู่แล้ว', 409)
    if (!value) throw validationError('Course not found', 404)
    await notifyAdmins({ title: 'มีคำขอเพิ่มข้อมูลผู้สอน', message: `${value.teacherName} · ${value.courseCode} · ${value.academicYear}/${value.semester}` })
    res.status(201).json(value)
  } catch (error) { next(error) }
}
