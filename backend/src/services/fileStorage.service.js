import { config } from '../config/environment.js'
import { storage } from './storageAdapter.js'

export const usesExternalStorage = config.storageDriver !== 'database'

export function fileBlobKey(binaryHash) {
  return `sha256/${binaryHash}`
}

export async function storeFileBytes({ binaryHash, fileData, metadata = {} }) {
  if (!usesExternalStorage) return null
  const key = fileBlobKey(binaryHash)
  const bytes = Buffer.from(fileData)
  await storage.save(key, bytes, { ...metadata, binaryHash, size: bytes.length })
  return key
}

export async function readFileBytes(blobKey) {
  if (!usesExternalStorage || !blobKey) return null
  return storage.read(blobKey)
}

export async function deleteFileBytes(blobKey) {
  if (usesExternalStorage && blobKey) await storage.delete(blobKey)
}
