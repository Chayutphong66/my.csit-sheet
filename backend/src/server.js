import { logServerError } from './services/safeLogger.service.js'
import { attachGracefulShutdown } from './services/serverLifecycle.js'

let closeDatabase
try {
  const { config } = await import('./config/environment.js')
  const { default: app } = await import('./app.js')
  const database = await import('./data/databaseClient.js')
  closeDatabase = database.closeDatabase
  const { checkDatabaseConnection } = database
  await checkDatabaseConnection()
  const server = app.listen(config.port, config.host, () => console.info(JSON.stringify({ event: 'server.started', port: config.port })))
  attachGracefulShutdown(server, closeDatabase)
} catch (error) {
  logServerError('server.startup_failed', error, { stage: 'startup' })
  if (closeDatabase) {
    try { await closeDatabase() } catch (closeError) { logServerError('server.cleanup_failed', closeError) }
  }
  process.exitCode = 1
}
