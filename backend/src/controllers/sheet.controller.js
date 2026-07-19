import { findSheetsByUploaderId } from '../repositories/sheet.repository.js'

function publicSheet(sheet) {
  const { uploaderId, uploaderUsername, uploaderEmail, rejectReason, ...safeSheet } = sheet
  return safeSheet
}

export function getMySheets(req, res) {
  const mine = findSheetsByUploaderId(req.user.id).map(publicSheet)
  res.json(mine)
}
