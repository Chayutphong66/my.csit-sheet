import { logServerError } from './safeLogger.service.js'

export function attachGracefulShutdown(server, closeDatabase, { signals = process, exit = code => process.exit(code), timeoutMs = 10000 } = {}) {
  let stopping = false
  const shutdown = (signal, exitCode = 0) => {
    if (stopping) return
    stopping = true
    console.info(JSON.stringify({ event: 'server.shutdown', signal }))
    const deadline = setTimeout(() => exit(1), timeoutMs)
    deadline.unref()
    server.close(async () => {
      try { await closeDatabase(); clearTimeout(deadline); exit(exitCode) }
      catch (error) { clearTimeout(deadline); logServerError('server.shutdown_failed', error); exit(1) }
    })
    server.closeIdleConnections()
  }
  server.on('error', error => { logServerError('server.listen_failed', error); shutdown('listen-error', 1) })
  signals.once('SIGTERM', () => shutdown('SIGTERM'))
  signals.once('SIGINT', () => shutdown('SIGINT'))
  return shutdown
}
