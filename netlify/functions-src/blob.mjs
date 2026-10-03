import { getStore } from '@netlify/blobs'
import { db } from '../../backend/src/data/databaseClient.js'
import { findUserById } from '../../backend/src/repositories/user.repository.js'
import { recordDocumentInteraction } from '../../backend/src/repositories/communityInteraction.repository.js'
import { parseAccessToken } from '../../backend/src/services/token.service.js'

const store = () => getStore({ name: 'csit-sheet-files', consistency: 'strong' })

function json(message, status) {
  return new Response(JSON.stringify({ message }), { status, headers: { 'content-type': 'application/json' } })
}

async function authenticate(request) {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)
  const payload = match ? parseAccessToken(match[1]) : null
  return payload?.sub ? findUserById(payload.sub) : null
}

async function publicDocumentFile(kind, id) {
  const type = kind === 'lecture' ? 'Lecture' : kind === 'sheet' ? 'Sheet' : null
  if (!type) return null
  const table = type === 'Lecture' ? 'lectures' : 'sheets'
  const files = type === 'Lecture' ? 'lecture_files' : 'sheet_files'
  const link = type === 'Lecture' ? 'lecture_id' : 'sheet_id'
  const row = await db.prepare(`
    SELECT documents.id, documents.uploader_id, versions.original_filename AS version_filename,
      versions.mime_type AS version_mime_type, versions.file_size AS version_file_size,
      linked.original_filename AS linked_filename, linked.mime_type AS linked_mime_type,
      linked.file_size AS linked_file_size, assets.blob_key, assets.file_data
    FROM ${table} documents
    LEFT JOIN document_versions versions ON versions.id = documents.current_version_id AND versions.status = 'APPROVED'
    LEFT JOIN ${files} linked ON linked.${link} = documents.id
    JOIN file_assets assets ON assets.id = COALESCE(versions.file_asset_id, linked.file_asset_id)
    WHERE documents.id = ? AND documents.status = 'APPROVED'
  `).get(id)
  return row && {
    ...row, documentType: type,
    fileName: row.version_filename || row.linked_filename,
    mimeType: row.version_mime_type || row.linked_mime_type,
    fileSize: Number(row.version_file_size || row.linked_file_size || 0)
  }
}

async function versionFile(id, user) {
  return await db.prepare(`
    SELECT versions.original_filename AS file_name, versions.mime_type, versions.file_size,
      versions.status, assets.blob_key, assets.file_data
    FROM document_versions versions JOIN file_assets assets ON assets.id = versions.file_asset_id
    WHERE versions.id = ? AND (versions.status = 'APPROVED' OR ? = 'ADMIN')
  `).get(id, user.role)
}

async function requestFile(id, user) {
  return await db.prepare(`
    SELECT requests.file_name, requests.file_type AS mime_type, requests.file_size,
      assets.blob_key, COALESCE(assets.file_data, requests.file_data) AS file_data
    FROM upload_requests requests LEFT JOIN file_assets assets ON assets.id = requests.file_asset_id
    WHERE requests.id = ? AND (requests.user_id = ? OR ? = 'ADMIN')
  `).get(id, user.id, user.role)
}

export default async function handler(request, context) {
  try {
    const user = await authenticate(request)
    if (!user) return json('Unauthorized', 401)
    const segments = new URL(request.url).pathname.split('/').filter(Boolean)
    const [kind, id, action] = context.params?.kind
      ? [context.params.kind, context.params.id, context.params.action]
      : segments.slice(-3)
    if (!['view', 'download'].includes(action)) return json('Not found', 404)

    let file
    let interaction = null
    if (kind === 'lecture' || kind === 'sheet') {
      file = await publicDocumentFile(kind, id)
      if (file) {
        interaction = {
          userId: user.id,
          document: { id: file.id, documentType: file.documentType, uploaderId: file.uploader_id },
          interactionType: action === 'download' ? 'DOWNLOAD' : 'VIEW'
        }
      }
    } else if (kind === 'version') file = await versionFile(id, user)
    else if (kind === 'request') file = await requestFile(id, user)
    else return json('Not found', 404)
    if (!file) return json('File not found', 404)

    const body = file.blob_key
      ? await store().get(file.blob_key, { type: 'stream' })
      : file.file_data
    if (!body) return json('File not found', 404)
    if (interaction) await recordDocumentInteraction(interaction)
    const fileName = file.fileName || file.file_name || 'document'
    const disposition = action === 'download' ? 'attachment' : 'inline'
    return new Response(body, {
      headers: {
        'content-type': file.mimeType || file.mime_type || 'application/octet-stream',
        'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'x-content-type-options': 'nosniff',
        ...(file.fileSize || file.file_size ? { 'content-length': String(file.fileSize || file.file_size) } : {})
      }
    })
  } catch (error) {
    console.error('Blob delivery failed', error)
    return json('Internal server error', 500)
  }
}

export const config = { path: '/api/blob/:kind/:id/:action' }
