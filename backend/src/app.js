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

const projectRoot = path.basename(process.cwd()).toLowerCase() === 'backend'
  ? path.resolve(process.cwd(), '..')
  : process.cwd()
const frontendDist = path.resolve(projectRoot, 'frontend/dist')

const app = express()
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT)
const configuredOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const platformOrigins = [process.env.URL]
  .map((origin) => String(origin || '').trim())
  .filter(Boolean)
const allowedOrigins = configuredOrigins.length > 0
  ? [...new Set([...configuredOrigins, ...platformOrigins])]
  : isProduction
    ? platformOrigins
    : ['http://127.0.0.1:5173', 'http://localhost:5173']

function isNetlifySiteOrigin(origin) {
  if (!process.env.SITE_NAME || !origin) return false
  try {
    const hostname = new URL(origin).hostname
    return hostname === `${process.env.SITE_NAME}.netlify.app` || hostname.endsWith(`--${process.env.SITE_NAME}.netlify.app`)
  } catch {
    return false
  }
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: { frameSrc: ["'self'", 'blob:'] }
  }
}))
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isNetlifySiteOrigin(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('CORS origin not allowed'))
  },
  credentials: true
}))
app.use(express.json({ limit: '30mb' }))
app.use(cookieParser())
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next()
  const startedAt = Date.now()
  res.on('finish', () => {
    console.info(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`)
  })
  next()
})

app.get('/api/health', async (_req, res) => {
  try {
    await checkDatabaseConnection()
    res.json({ status: 'ok', database: 'ready' })
  } catch (error) {
    logServerError('api.health_failed', error, { route: '/api/health' })
    res.status(500).json({
      message: 'Internal server error',
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
      path: _req.path,
      status
    })
  }
  const message = status < 500 || error.expose || !isProduction
    ? error.message
    : 'Internal server error'
  res.status(status).json({ message: message ?? 'Internal server error' })
})

export default app
