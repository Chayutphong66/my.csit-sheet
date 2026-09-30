import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import { validateIdParam, validateIdParams } from '../middleware/validation.middleware.js'
import * as adminController from '../controllers/admin.controller.js'

const router = Router()

router.use(requireAuth, requireRole('ADMIN'))
router.get('/users', adminController.getUsers)
router.get('/upload-requests', adminController.getUploadRequests)
router.get('/upload-requests/:id/file', validateIdParam, adminController.getUploadRequestFile)
router.post('/upload-requests', adminController.createUploadRequestAsAdmin)
router.patch('/upload-requests/:id/approve', validateIdParam, adminController.approveUploadRequest)
router.patch('/upload-requests/:id/reject', validateIdParam, adminController.rejectUploadRequest)
router.patch('/upload-requests/:id/reject-duplicate', validateIdParam, adminController.rejectDuplicateUploadRequest)
router.get('/sheets/pending', adminController.getPendingSheets)
router.patch('/sheets/:id/approve', adminController.approveSheet)
router.patch('/sheets/:id/reject', adminController.rejectSheet)
router.get('/stats', adminController.getStats)
router.post('/course-imports/preview', adminController.previewCourseImport)
router.post('/course-imports/confirm', adminController.confirmCourseImport)
router.get('/course-imports', adminController.getCourseImportHistory)
router.get('/revisions', adminController.getRevisions)
router.get('/revisions/:id', validateIdParam, adminController.getRevision)
router.get('/revisions/:id/file', validateIdParam, adminController.getRevisionFile)
router.patch('/revisions/:id/approve', validateIdParam, adminController.approveDocumentRevision)
router.patch('/revisions/:id/reject', validateIdParam, adminController.rejectDocumentRevision)
router.post('/documents/:type/:documentId/restore/:versionId', validateIdParams('documentId', 'versionId'), adminController.restoreVersion)
router.get('/teachers', adminController.getTeachers)
router.post('/teachers', adminController.addTeacher)
router.patch('/teachers/:id', validateIdParam, adminController.editTeacher)
router.get('/teachers/:id/offerings', validateIdParam, adminController.getTeacherOfferings)
router.get('/course-offerings', adminController.getOfferings)
router.put('/course-offerings', adminController.putOffering)
router.get('/teacher-suggestions', adminController.getTeacherSuggestions)
router.patch('/teacher-suggestions/:id', validateIdParam, adminController.decideTeacherSuggestion)

export default router
