import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateLocalEphemeralStorageEnvironment } from '../../backend/src/services/ephemeralStorageSafety.js'

const configuration = validateLocalEphemeralStorageEnvironment(process.env)
const headers = {
  apikey: configuration.storageKey,
  'content-type': 'application/json'
}
if (!configuration.storageKey.startsWith('sb_secret_')) headers.authorization = `Bearer ${configuration.storageKey}`

const createResponse = await fetch(`${configuration.storageUrl}/storage/v1/bucket`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    id: configuration.storageBucket,
    name: configuration.storageBucket,
    public: false,
    file_size_limit: 6 * 1024 * 1024,
    allowed_mime_types: ['application/octet-stream', 'image/png']
  })
})
if (!createResponse.ok) throw new Error(`Unable to create the ephemeral private bucket (${createResponse.status})`)

const metadataResponse = await fetch(`${configuration.storageUrl}/storage/v1/bucket/${encodeURIComponent(configuration.storageBucket)}`, { headers })
if (!metadataResponse.ok) throw new Error(`Unable to verify the ephemeral private bucket (${metadataResponse.status})`)
const metadata = await metadataResponse.json()
if (metadata.public !== false) throw new Error('The ephemeral verification bucket must be private')

const evidencePath = path.resolve(process.env.EXTERNAL_STORAGE_BOOTSTRAP_EVIDENCE_PATH || 'artifacts/ephemeral-storage-bootstrap.json')
await mkdir(path.dirname(evidencePath), { recursive: true })
await writeFile(evidencePath, JSON.stringify({ status: 'READY', provider: 'supabase-local', ephemeral: true, privateBucket: true }, null, 2))
