import { closeDatabase } from './databaseClient.js'
import { countFileAssets, deleteOrphanFileAssets } from '../repositories/fileAsset.repository.js'

try {
  const before = await countFileAssets()
  const removed = await deleteOrphanFileAssets()
  const after = await countFileAssets()
  console.log(JSON.stringify({ before, removed, after }))
} finally { await closeDatabase() }
