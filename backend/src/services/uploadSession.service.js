import crypto from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { databaseDialect } from '../data/databaseClient.js'
import { MAX_FILE_BYTES } from './uploadValidation.service.js'

export const MAX_CHUNK_BYTES = 2 * 1024 * 1024
const SESSION_TTL_MS = 60 * 60 * 1000
const STORE_NAME = 'csit-sheet-upload-chunks'
const localEntries = new Map()

function blobStore() { return getStore({ name: STORE_NAME, consistency: 'strong' }) }
function manifestKey(id) { return `sessions/${id}/manifest` }
function chunkKey(id, index) { return `sessions/${id}/chunks/${index}` }

async function setValue(key, value, options = {}) {
  if (databaseDialect === 'postgres') {
    if (!Buffer.isBuffer(value)) return blobStore().setJSON(key, value, options)
    const bytes = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
    return blobStore().set(key, bytes, options)
  }
  localEntries.set(key, Buffer.isBuffer(value) ? Buffer.from(value) : structuredClone(value))
}

async function getValue(key, type = 'json') {
  if (databaseDialect === 'postgres') return blobStore().get(key, { type })
  const value = localEntries.get(key)
  return Buffer.isBuffer(value) ? Buffer.from(value) : value ? structuredClone(value) : null
}

async function deleteValue(key) {
  if (databaseDialect === 'postgres') await blobStore().delete(key)
  else localEntries.delete(key)
}

function sessionError(message, status = 400) {
  const error = new Error(message); error.status = status; error.expose = true; return error
}

async function ownedManifest(id, userId) {
  const manifest = await getValue(manifestKey(id))
  if (!manifest || manifest.userId !== userId) throw sessionError('Upload session not found', 404)
  if (Date.now() - new Date(manifest.createdAt).getTime() > SESSION_TTL_MS) {
    await discardUploadSession(id, manifest)
    throw sessionError('Upload session has expired', 410)
  }
  return manifest
}

export async function createUploadSession({ userId, fileName, fileType, fileSize, totalChunks }) {
  const size = Number(fileSize)
  const chunks = Number(totalChunks)
  if (!fileName || !fileType || !Number.isInteger(size) || size < 1 || size > MAX_FILE_BYTES) throw sessionError('Invalid upload metadata')
  if (!Number.isInteger(chunks) || chunks < 1 || chunks > Math.ceil(MAX_FILE_BYTES / MAX_CHUNK_BYTES)) throw sessionError('Invalid chunk count')
  const id = crypto.randomUUID()
  await setValue(manifestKey(id), { id, userId, fileName, fileType, fileSize: size, totalChunks: chunks, createdAt: new Date().toISOString() })
  return { id, chunkSize: MAX_CHUNK_BYTES }
}

export async function storeUploadChunk({ id, userId, index, data }) {
  const manifest = await ownedManifest(id, userId)
  const chunkIndex = Number(index)
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= manifest.totalChunks) throw sessionError('Invalid chunk index')
  if (typeof data !== 'string' || !data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw sessionError('Invalid chunk data')
  const bytes = Buffer.from(data, 'base64')
  if (!bytes.length || bytes.length > MAX_CHUNK_BYTES) throw sessionError('Invalid chunk size', 413)
  await setValue(chunkKey(id, chunkIndex), bytes)
  return { index: chunkIndex, size: bytes.length }
}

export async function readUploadSession({ id, userId }) {
  const manifest = await ownedManifest(id, userId)
  const chunks = []
  for (let index = 0; index < manifest.totalChunks; index += 1) {
    const value = await getValue(chunkKey(id, index), databaseDialect === 'postgres' ? 'arrayBuffer' : 'buffer')
    if (!value) throw sessionError(`Upload chunk ${index} is missing`, 409)
    chunks.push(Buffer.from(value))
  }
  const fileData = Buffer.concat(chunks)
  if (fileData.length !== manifest.fileSize || fileData.length > MAX_FILE_BYTES) throw sessionError('Uploaded file size does not match the session', 409)
  return { ...manifest, fileData }
}

export async function discardUploadSession(id, knownManifest = null) {
  const manifest = knownManifest || await getValue(manifestKey(id))
  if (!manifest) return
  await Promise.all([
    ...Array.from({ length: manifest.totalChunks }, (_, index) => deleteValue(chunkKey(id, index))),
    deleteValue(manifestKey(id))
  ])
}

export async function resolveUploadBody(body, userId) {
  if (!body?.uploadSessionId) return { body, sessionId: null }
  const upload = await readUploadSession({ id: body.uploadSessionId, userId })
  return {
    body: { ...body, fileName: upload.fileName, fileType: upload.fileType, fileSize: upload.fileSize, fileData: upload.fileData.toString('base64') },
    sessionId: upload.id
  }
}
