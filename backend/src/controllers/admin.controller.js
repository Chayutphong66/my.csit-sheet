import { countUsers } from '../repositories/user.repository.js'
import {
  countSheets,
  countSheetsByStatus,
  findPendingSheets,
  updateSheetStatus
} from '../repositories/sheet.repository.js'

export function getPendingSheets(_req, res) {
  res.json(findPendingSheets())
}

export function approveSheet(req, res) {
  const updated = updateSheetStatus(req.params.id, 'APPROVED')
  if (!updated) {
    res.status(404).json({ message: 'ไม่พบชีท' })
    return
  }
  res.status(204).end()
}

export function rejectSheet(req, res) {
  const updated = updateSheetStatus(req.params.id, 'REJECTED', req.body.reason ?? '')
  if (!updated) {
    res.status(404).json({ message: 'ไม่พบชีท' })
    return
  }
  res.status(204).end()
}

export function getStats(_req, res) {
  res.json({
    totalUsers: countUsers(),
    totalSheets: countSheets(),
    pendingCount: countSheetsByStatus('PENDING'),
    approvedCount: countSheetsByStatus('APPROVED')
  })
}
