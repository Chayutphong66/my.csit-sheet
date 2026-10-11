import { config } from '../config/environment.js'
import { storage } from './storageAdapter.js'

export const usesExternalStorage = config.storageDriver !== 'database'

// Supabase uses the provider-neutral storage_key column. Netlify and local
// compatibility schemas still expose the legacy blob_key column. Keep this
// choice in one place so file readers do not silently lose production assets
// that were migrated with storage_key only.
export function storageReferenceSql(tableAlias = 'file_assets', storageDriver = config.storageDriver) {
  return storageDriver === 'supabase'
    ? `COALESCE(${tableAlias}.storage_key, ${tableAlias}.blob_key)`
    : `${tableAlias}.blob_key`
}

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
