import { db } from './database.js'
import { countFileAssets, deleteOrphanFileAssets } from '../repositories/fileAsset.repository.js'

const before = countFileAssets()
const removed = deleteOrphanFileAssets()
const after = countFileAssets()

console.log(JSON.stringify({ before, removed, after }))
db.close()
