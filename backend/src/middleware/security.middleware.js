const DEFAULT_WINDOW_MS = 15 * 60 * 1000

export function createRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  max = 20,
  keyPrefix = 'rate-limit'
} = {}) {
  const hits = new Map()

  return (req, res, next) => {
    const now = Date.now()
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown'
    const key = `${keyPrefix}:${ip}`
    const current = hits.get(key)

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    current.count += 1
    if (current.count > max) {
      res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)))
      res.status(429).json({ message: 'Too many authentication attempts. Please try again later.' })
      return
    }

    next()
  }
}
