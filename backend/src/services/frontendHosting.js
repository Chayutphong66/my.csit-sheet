import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const defaultFrontendDist = fileURLToPath(new URL('../../../frontend/dist/', import.meta.url))

function setStaticCacheHeaders(res, filePath) {
  const assetsDirectory = `${path.sep}assets${path.sep}`
  if (filePath.includes(assetsDirectory)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return
  }
  res.setHeader('Cache-Control', 'no-cache')
}

export function mountProductionFrontend(app, { enabled, frontendDist = defaultFrontendDist } = {}) {
  const indexPath = path.join(frontendDist, 'index.html')
  if (!enabled || !existsSync(indexPath)) return false

  app.use(express.static(frontendDist, {
    index: false,
    setHeaders: setStaticCacheHeaders
  }))

  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html') || path.extname(req.path)) return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(indexPath)
  })

  return true
}
