import crypto from 'node:crypto'
import { db, lockBulkUploadItem, withTransaction } from '../data/databaseClient.js'
import { createUploadRequest } from '../repositories/uploadRequest.repository.js'
import { createCollection, requireActiveCollection } from '../repositories/collection.repository.js'
import { decodeUploadedFile, validateUploadPayload } from './uploadValidation.service.js'

const MAX_ITEMS = 20
const MAX_BATCH_BYTES = 20 * 1024 * 1024

function error(message, status = 400) { const cause = new Error(message); cause.status = status; cause.expose = true; return cause }
function safeError(cause) { return cause?.status && cause.status < 500 ? String(cause.message).slice(0, 500) : 'Upload processing failed' }
function clientKeys(items) {
  const keys = items.map(item => String(item?.clientKey ?? '').trim())
  if (keys.some(key => !/^[A-Za-z0-9_-]{1,100}$/.test(key))) throw error('Each item requires a safe unique clientKey')
  if (new Set(keys).size !== keys.length) throw error('clientKey must be unique within a bulk upload')
  return keys
}
function batchBytes(items) { return items.reduce((total,item)=>total+Math.floor(String(item?.fileData??'').replace(/^data:[^;]*;base64,/,'').length*3/4),0) }

async function jobForOwner(id, actorId) {
  const job = await db.prepare(`SELECT id,created_by createdBy,collection_id collectionId,status,total_items totalItems,
    succeeded_items succeededItems,failed_items failedItems,created_at createdAt,updated_at updatedAt
    FROM bulk_upload_jobs WHERE id=? AND created_by=?`).get(id, actorId)
  if (!job) throw error('Bulk upload job not found', 404)
  const items = await db.prepare(`SELECT id,client_key clientKey,request_id requestId,status,error_code errorCode,
    error_message errorMessage,attempt_count attemptCount,created_at createdAt,updated_at updatedAt
    FROM bulk_upload_items WHERE job_id=? ORDER BY created_at,client_key`).all(id)
  return { ...job, totalItems: Number(job.totalItems), succeededItems: Number(job.succeededItems), failedItems: Number(job.failedItems), items }
}

async function refreshJob(id) {
  const totals = await db.prepare(`SELECT COUNT(*) total,
    SUM(CASE WHEN status IN ('READY','DUPLICATE') THEN 1 ELSE 0 END) succeeded,
    SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) failed FROM bulk_upload_items WHERE job_id=?`).get(id)
  const succeeded = Number(totals.succeeded || 0); const failed = Number(totals.failed || 0); const total = Number(totals.total || 0)
  const status = failed === 0 ? 'COMPLETED' : succeeded === 0 ? 'FAILED' : 'PARTIAL'
  await db.prepare('UPDATE bulk_upload_jobs SET status=?,total_items=?,succeeded_items=?,failed_items=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(status, total, succeeded, failed, id)
}

async function processItem({ jobId, actorId, actorRole, collectionId, item, sharedMetadata = {}, retry = false }) {
  const clientKey = String(item?.clientKey ?? '').trim()
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(clientKey)) throw error('Each item requires a safe unique clientKey')
  await lockBulkUploadItem(jobId, clientKey)
  const existing = await db.prepare('SELECT id,status,attempt_count attemptCount FROM bulk_upload_items WHERE job_id=? AND client_key=?').get(jobId, clientKey)
  if (retry && (!existing || existing.status !== 'FAILED')) throw error(`Item ${clientKey} is not retryable`, 409)
  if (!retry && existing) throw error(`Duplicate clientKey: ${clientKey}`, 409)
  const itemId = existing?.id || crypto.randomUUID()
  try {
    const payload = { ...sharedMetadata, ...item }
    if (!item.courseId) payload.courseId = sharedMetadata.courseId
    if (!item.documentType) payload.documentType = sharedMetadata.documentType
    const validated = await validateUploadPayload(payload)
    const fileData = decodeUploadedFile(payload.fileData, validated.fileType)
    const collection = collectionId ? await requireActiveCollection(collectionId, actorRole === 'ADMIN' ? null : { id: actorId, role: actorRole }) : null
    if (collection?.collectionType === 'COURSE' && validated.courseId !== collection.courseId) throw error(`File ${clientKey} belongs to another course; this COURSE Collection requires ${collection.courseCode}`, 409)
    const request = await createUploadRequest({ userId: actorId, ...validated, fileSize: fileData.length, fileData, collectionId })
    const status = request.duplicateStatus === 'NONE' ? 'READY' : 'DUPLICATE'
    if (existing) await db.prepare(`UPDATE bulk_upload_items SET request_id=?,status=?,error_code='',error_message='',attempt_count=attempt_count+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(request.id, status, itemId)
    else await db.prepare('INSERT INTO bulk_upload_items(id,job_id,client_key,request_id,status) VALUES(?,?,?,?,?)').run(itemId, jobId, clientKey, request.id, status)
  } catch (cause) {
    if (existing) await db.prepare(`UPDATE bulk_upload_items SET status='FAILED',error_code=?,error_message=?,attempt_count=attempt_count+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(String(cause.code || 'VALIDATION_ERROR').slice(0, 80), safeError(cause), itemId)
    else await db.prepare(`INSERT INTO bulk_upload_items(id,job_id,client_key,status,error_code,error_message) VALUES(?,?,?,'FAILED',?,?)`).run(itemId, jobId, clientKey, String(cause.code || 'VALIDATION_ERROR').slice(0, 80), safeError(cause))
  }
}

export async function createBulkUpload({ actorId, actorRole = 'ADMIN', body }) {
  if (!Array.isArray(body?.items) || !body.items.length || body.items.length > MAX_ITEMS) throw error(`Bulk upload requires 1-${MAX_ITEMS} items`)
  if (batchBytes(body.items) > MAX_BATCH_BYTES) throw error('Bulk upload batch must not exceed 20 MB')
  clientKeys(body.items)
  let collection
  if (body.newCollection) collection = await createCollection(actorId, body.newCollection)
  else collection = await requireActiveCollection(String(body.collectionId ?? '').trim(), actorRole === 'ADMIN' ? null : { id: actorId, role: actorRole })
  const id = crypto.randomUUID()
  await db.prepare('INSERT INTO bulk_upload_jobs(id,created_by,collection_id,total_items) VALUES(?,?,?,?)').run(id, actorId, collection?.id || null, body.items.length)
  const sharedMetadata = body.sharedMetadata && typeof body.sharedMetadata === 'object' ? body.sharedMetadata : {}
  for (const item of body.items) await withTransaction(() => processItem({ jobId: id, actorId, actorRole, collectionId: collection?.id || null, item, sharedMetadata }))
  await refreshJob(id)
  return jobForOwner(id, actorId)
}

export async function getBulkUpload({ id, actorId }) { return jobForOwner(id, actorId) }

export async function retryBulkUpload({ id, actorId, actorRole = 'ADMIN', body }) {
  const job = await jobForOwner(id, actorId)
  if (!Array.isArray(body?.items) || !body.items.length || body.items.length > MAX_ITEMS) throw error(`Retry requires 1-${MAX_ITEMS} failed items`)
  if (batchBytes(body.items) > MAX_BATCH_BYTES) throw error('Retry batch must not exceed 20 MB')
  const keys = clientKeys(body.items)
  const retryable = new Set(job.items.filter(item => item.status === 'FAILED').map(item => item.clientKey))
  if (keys.some(key => !retryable.has(key))) throw error('Retry accepts failed items only', 409)
  await requireActiveCollection(job.collectionId, actorRole === 'ADMIN' ? null : { id: actorId, role: actorRole })
  const sharedMetadata = body.sharedMetadata && typeof body.sharedMetadata === 'object' ? body.sharedMetadata : {}
  for (const item of body.items) await withTransaction(() => processItem({ jobId: id, actorId, actorRole, collectionId: job.collectionId, item, sharedMetadata, retry: true }))
  await refreshJob(id)
  return jobForOwner(id, actorId)
}
