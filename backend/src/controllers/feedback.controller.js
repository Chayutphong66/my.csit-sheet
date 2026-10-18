import * as feedbackService from '../services/feedback.service.js'

export async function submit(req, res, next) {
  try {
    const result = await feedbackService.submitFeedback(req.user.id, req.body || {})
    res.status(result.created ? 201 : 200).json({ ...result.report, replayed: !result.created })
  } catch (error) { next(error) }
}
export async function listMine(req, res, next) {
  try { res.json(await feedbackService.listOwnFeedback(req.user.id, req.query)) } catch (error) { next(error) }
}
export async function getMine(req, res, next) {
  try { res.json(await feedbackService.getOwnFeedback(req.user.id, req.params.reference)) } catch (error) { next(error) }
}
