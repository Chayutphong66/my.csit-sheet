import { getStore } from '@netlify/blobs'
import { databaseDialect } from '../data/databaseClient.js'

const STORE_NAME = 'csit-sheet-files'

export const usesNetlifyBlobs = databaseDialect === 'postgres'

function store() {
  return getStore({ name: STORE_NAME, consistency: 'strong' })
}

export function fileBlobKey(binaryHash) {
  return `sha256/${binaryHash}`
}

export async function storeFileBytes({ binaryHash, fileData, metadata = {} }) {
  if (!usesNetlifyBlobs) return null
  const key = fileBlobKey(binaryHash)
  const bytes = Buffer.from(fileData)
  const value = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  await store().set(key, value, {
    onlyIfNew: true,
    metadata: { ...metadata, binaryHash, size: bytes.length }
  })
  return key
}

export async function readFileBytes(blobKey) {
  if (!usesNetlifyBlobs || !blobKey) return null
  const value = await store().get(blobKey, { type: 'arrayBuffer' })
  return value ? Buffer.from(value) : null
}

export async function deleteFileBytes(blobKey) {
  if (usesNetlifyBlobs && blobKey) await store().delete(blobKey)
}
