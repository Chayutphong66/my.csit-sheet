import app from './app.js'
import { db } from './data/database.js'

const port = process.env.PORT ?? 8080
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')

const server = app.listen(port, host, () => {
  console.log(`CSIT Sheet API running on http://${host}:${port}`)
})

function shutdown(signal) {
  console.info(`${signal} received; shutting down`)
  server.close(() => {
    db.close()
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
