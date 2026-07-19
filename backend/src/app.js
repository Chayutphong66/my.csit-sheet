import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.routes.js'
import sheetRoutes from './routes/sheet.routes.js'
import adminRoutes from './routes/admin.routes.js'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://127.0.0.1:5173',
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'csit-sheet-api', port: Number(process.env.PORT ?? 8080) })
})

app.use('/api/auth', authRoutes)
app.use('/api/sheets', sheetRoutes)
app.use('/api/admin', adminRoutes)

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
})

app.use((error, _req, res, _next) => {
  const status = error.status ?? 500
  res.status(status).json({ message: error.message ?? 'Internal server error' })
})

export default app
