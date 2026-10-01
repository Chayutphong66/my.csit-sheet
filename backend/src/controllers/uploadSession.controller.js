import { createUploadSession, storeUploadChunk } from '../services/uploadSession.service.js'

export async function create(req, res, next) {
  try { res.status(201).json(await createUploadSession({ userId: req.user.id, ...req.body })) }
  catch (error) { next(error) }
}

export async function putChunk(req, res, next) {
  try {
    const result = await storeUploadChunk({ id: req.params.id, userId: req.user.id, index: req.params.index, data: req.body?.data })
    res.status(201).json(result)
  } catch (error) { next(error) }
}
