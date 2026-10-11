import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateIdParam, validateIdParams } from '../middleware/validation.middleware.js'
import * as controller from '../controllers/collection.controller.js'

const router=Router()
router.use(requireAuth)
router.get('/discover',controller.discover)
router.get('/published/:slug',controller.published)
router.get('/published/:slug/cover',controller.cover)
router.get('/published/:slug/documents/:type/:documentId/view',validateIdParams('documentId'),controller.readerFile)
router.get('/mine',controller.mine)
router.post('/',controller.create)
router.post('/bulk-uploads',controller.bulkCreate)
router.get('/bulk-uploads/:id',validateIdParam,controller.bulkGet)
router.post('/bulk-uploads/:id/retry',validateIdParam,controller.bulkRetry)
router.get('/:id',validateIdParam,controller.detail)
router.patch('/:id',validateIdParam,controller.edit)
router.post('/:id/lifecycle/:action',validateIdParam,controller.lifecycle)
router.post('/:id/sections',validateIdParam,controller.addSection)
router.patch('/:id/sections/:sectionId',validateIdParams('id','sectionId'),controller.editSection)
router.delete('/:id/sections/:sectionId',validateIdParams('id','sectionId'),controller.deleteSection)
router.post('/:id/documents',validateIdParam,controller.addDocument)
router.delete('/:id/documents/:type/:documentId',validateIdParams('id','documentId'),controller.deleteDocument)
router.put('/:id/order',validateIdParam,controller.saveOrder)
router.post('/:id/cover',validateIdParam,controller.uploadCover)
router.delete('/:id/cover',validateIdParam,controller.removeCover)
export default router
