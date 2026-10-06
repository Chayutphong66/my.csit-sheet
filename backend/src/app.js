import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { existsSync } from 'node:fs'
import path from 'node:path'
import authRoutes from './routes/auth.routes.js'
import sheetRoutes from './routes/sheet.routes.js'
import adminRoutes from './routes/admin.routes.js'
import lectureRoutes from './routes/lecture.routes.js'
import uploadRequestRoutes from './routes/uploadRequest.routes.js'
import notificationRoutes from './routes/notification.routes.js'
import { courseRouter, documentRouter } from './routes/document.routes.js'
import contributorRoutes from './routes/contributor.routes.js'
import { curriculumRouter, suggestionRouter } from './routes/academic.routes.js'
import { checkDatabaseConnection } from './data/databaseClient.js'
import uploadSessionRoutes from './routes/uploadSession.routes.js'
import { databaseDiagnosticCode, logServerError } from './services/safeLogger.service.js'
import { config } from './config/environment.js'
import crypto from 'node:crypto'

const projectRoot = path.basename(process.cwd()).toLowerCase() === 'backend'
  ? path.resolve(process.cwd(), '..')
  : process.cwd()
const frontendDist = path.resolve(projectRoot, 'frontend/dist')

const app = express()
const isProduction = config.production
const allowedOrigins = config.allowedOrigins

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID()
  res.setHeader('X-Request-ID', req.requestId)
  next()
})
app.use(helmet({
  contentSecurityPolicy: {
    directives: { frameSrc: ["'self'", 'blob:'] }
  }
}))
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    const error = new Error('CORS origin not allowed')
    error.status = 403
    callback(error)
  },
  credentials: true
}))
app.use(express.json({ limit: '30mb' }))
app.use(cookieParser())
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next()
  const startedAt = Date.now()
  res.on('finish', () => {
    console.info(JSON.stringify({ event: 'api.request', requestId: req.requestId, method: req.method, route: req.route?.path || 'unmatched', status: res.statusCode, durationMs: Date.now() - startedAt }))
  })
  next()
})

app.get('/api/health', async (req, res) => {
  try {
    await checkDatabaseConnection()
    res.json({ status: 'ok', database: 'ready' })
  } catch (error) {
    logServerError('api.health_failed', error, { route: '/api/health', requestId: req.requestId })
    res.status(503).json({
      status: 'unavailable', database: 'unavailable',
      diagnosticCode: databaseDiagnosticCode(error)
    })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/upload-sessions', uploadSessionRoutes)
app.use('/api/sheets', sheetRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/lectures', lectureRoutes)
app.use('/api/upload-requests', uploadRequestRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/catalog/courses', curriculumRouter)
app.use('/api/teacher-suggestions', suggestionRouter)
app.use('/api/courses', courseRouter)
app.use('/api/documents', documentRouter)
app.use('/api/contributors', contributorRoutes)

app.use('/api', (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
})

if (isProduction && existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
})

app.use((error, _req, res, _next) => {
  const status = error.status ?? 500
  if (status >= 500) {
    logServerError('api.unexpected_error', error, {
      method: _req.method,
      route: _req.route?.path || 'unmatched',
      status,
      requestId: _req.requestId
    })
  }
  const message = status < 500
    ? error.message
    : 'Internal server error'
  res.status(status).json({ message: message ?? 'Internal server error' })
})

export default app
