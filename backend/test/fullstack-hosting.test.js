import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import express from 'express'
import { mountProductionFrontend } from '../src/services/frontendHosting.js'

const dist = mkdtempSync(path.join(tmpdir(), 'csit-fullstack-'))
mkdirSync(path.join(dist, 'assets'))
writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>CSIT SPA fixture</title><main id="app"></main>')
writeFileSync(path.join(dist, 'assets', 'app-fixture.js'), 'globalThis.__fixture = true')

const app = express()
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: 'ready' }))
app.use('/api', (req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }))
assert.equal(mountProductionFrontend(app, { enabled: true, frontendDist: dist }), true)
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }))

const server = app.listen(0, '127.0.0.1')
await new Promise(resolve => server.once('listening', resolve))
const baseUrl = `http://127.0.0.1:${server.address().port}`
test.after(() => new Promise(resolve => server.close(resolve)))

for (const route of ['/', '/register', '/profile', '/nonexistent-vue-route']) {
  test(`SPA navigation ${route} serves index.html without long-lived caching`, async () => {
    const response = await fetch(`${baseUrl}${route}`, { headers: { accept: 'text/html' } })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /^text\/html/)
    assert.equal(response.headers.get('cache-control'), 'no-cache')
    assert.match(await response.text(), /CSIT SPA fixture/)
  })
}

test('fingerprinted frontend assets receive immutable caching', async () => {
  const response = await fetch(`${baseUrl}/assets/app-fixture.js`)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable')
})

test('API routes remain isolated from the SPA fallback', async () => {
  const health = await fetch(`${baseUrl}/api/health`)
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { status: 'ok', database: 'ready' })

  const missing = await fetch(`${baseUrl}/api/nonexistent`, { headers: { accept: 'text/html' } })
  assert.equal(missing.status, 404)
  assert.match(missing.headers.get('content-type'), /^application\/json/)
  assert.doesNotMatch(await missing.text(), /CSIT SPA fixture/)
})

test('missing asset-like paths do not receive the SPA shell', async () => {
  const response = await fetch(`${baseUrl}/assets/missing.js`, { headers: { accept: 'text/html' } })
  assert.equal(response.status, 404)
  assert.match(response.headers.get('content-type'), /^application\/json/)
})
