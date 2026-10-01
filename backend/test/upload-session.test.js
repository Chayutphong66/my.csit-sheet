import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.NODE_ENV = 'test'
process.env.SKIP_DB_SEED = '1'
process.env.DATABASE_PATH = path.join(tmpdir(), `csit-upload-session-${process.pid}-${Date.now()}.sqlite`)

const { createUploadSession, discardUploadSession, readUploadSession, storeUploadChunk } = await import('../src/services/uploadSession.service.js')
const { db } = await import('../src/data/database.js')
test.after(() => db.close())

test('authenticated chunks reconstruct a file and stay owner-scoped', async () => {
  const source = Buffer.alloc(5 * 1024 * 1024 + 17, 0x61)
  const chunkSize = 2 * 1024 * 1024
  const totalChunks = Math.ceil(source.length / chunkSize)
  const session = await createUploadSession({
    userId: 'owner', fileName: 'large.pdf', fileType: 'application/pdf',
    fileSize: source.length, totalChunks
  })
  for (let index = 0; index < totalChunks; index += 1) {
    const chunk = source.subarray(index * chunkSize, (index + 1) * chunkSize)
    await storeUploadChunk({ id: session.id, userId: 'owner', index, data: chunk.toString('base64') })
  }
  await assert.rejects(() => readUploadSession({ id: session.id, userId: 'other' }), /not found/)
  const reconstructed = await readUploadSession({ id: session.id, userId: 'owner' })
  assert.deepEqual(reconstructed.fileData, source)
  await discardUploadSession(session.id)
  await assert.rejects(() => readUploadSession({ id: session.id, userId: 'owner' }), /not found/)
})
