import path from 'node:path'

function configurationError(message) {
  const error = new Error(message)
  error.code = 'CONFIGURATION_ERROR'
  return error
}

function positiveInteger(value, fallback, name, maximum = 1000000) {
  const number = Number(value || fallback)
  if (!Number.isInteger(number) || number < 1 || number > maximum) throw configurationError(`${name} must be a positive integer up to ${maximum}`)
  return number
}

export function loadConfiguration(env = process.env) {
  if (env.NODE_ENV && !['development', 'test', 'production'].includes(env.NODE_ENV)) throw configurationError('NODE_ENV must be development, test or production')
  const production = env.NODE_ENV === 'production'
  const databaseDriver = env.DATABASE_DRIVER || (production ? 'postgres' : 'sqlite')
  if (!['sqlite', 'postgres'].includes(databaseDriver)) throw configurationError('DATABASE_DRIVER must be sqlite or postgres')
  if (production && databaseDriver === 'sqlite') throw configurationError('Production requires DATABASE_DRIVER=postgres')
  if (databaseDriver === 'postgres') {
    if (!env.DATABASE_URL?.trim()) throw configurationError('DATABASE_URL is required for DATABASE_DRIVER=postgres')
    try {
      const url = new URL(env.DATABASE_URL)
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error()
    } catch { throw configurationError('DATABASE_URL must be a valid PostgreSQL connection URL') }
  }
  const storageDriver = env.STORAGE_DRIVER || (production ? 'supabase' : 'database')
  if (!['database', 'supabase', 'netlify'].includes(storageDriver)) throw configurationError('STORAGE_DRIVER must be database, supabase or netlify')
  if (production && storageDriver === 'database') throw configurationError('Production requires external object storage')
  const storageKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (storageDriver === 'supabase') {
    if (!env.SUPABASE_URL?.trim()) throw configurationError('SUPABASE_URL is required for STORAGE_DRIVER=supabase')
    try {
      const url = new URL(env.SUPABASE_URL)
      if (url.protocol !== 'https:' || !url.hostname) throw new Error()
    } catch { throw configurationError('SUPABASE_URL must be a valid HTTPS URL') }
    if (!storageKey?.trim()) throw configurationError('SUPABASE_SECRET_KEY is required for STORAGE_DRIVER=supabase')
    if (!env.SUPABASE_STORAGE_BUCKET?.trim()) throw configurationError('SUPABASE_STORAGE_BUCKET is required for STORAGE_DRIVER=supabase')
  }
  const cookieSameSite = env.COOKIE_SAME_SITE || (production ? 'strict' : 'lax')
  if (!['strict', 'lax', 'none'].includes(cookieSameSite)) throw configurationError('COOKIE_SAME_SITE must be strict, lax or none')
  const cookieSecure = production || cookieSameSite === 'none'
  if (cookieSameSite === 'none' && !production) throw configurationError('COOKIE_SAME_SITE=none requires production HTTPS')
  const origins = (env.ALLOWED_ORIGINS || env.FRONTEND_URL || (production ? '' : 'http://127.0.0.1:5173,http://localhost:5173'))
    .split(',').map(value => value.trim()).filter(Boolean)
  for (const origin of origins) {
    try {
      const url = new URL(origin)
      if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || (production && url.protocol !== 'https:')) throw new Error()
    } catch { throw configurationError('ALLOWED_ORIGINS must contain explicit HTTP(S) origins; production requires HTTPS') }
  }
  if (production && !origins.length) throw configurationError('ALLOWED_ORIGINS or FRONTEND_URL is required in production')
  return Object.freeze({
    production, databaseDriver, databaseUrl: env.DATABASE_URL,
    databasePath: env.DATABASE_PATH, poolMax: positiveInteger(env.DATABASE_POOL_MAX, 5, 'DATABASE_POOL_MAX', 50),
    storageDriver, storageUrl: env.SUPABASE_URL,
    // Prefer Supabase's current server-only Secret key. Keep the legacy
    // service_role name as a transition path for existing deployments.
    storageKey,
    storageBucket: env.SUPABASE_STORAGE_BUCKET, port: positiveInteger(env.PORT, 8080, 'PORT', 65535),
    host: env.HOST || (production ? '0.0.0.0' : '127.0.0.1'),
    jwtSecret: env.JWT_SECRET?.trim(), accessTokenTtl: env.ACCESS_TOKEN_TTL || '15m',
    refreshDays: positiveInteger(env.REFRESH_TOKEN_TTL_DAYS, 7, 'REFRESH_TOKEN_TTL_DAYS', 3650),
    cookieSameSite, cookieSecure, allowedOrigins: origins,
    projectRoot: path.basename(process.cwd()).toLowerCase() === 'backend' ? path.resolve(process.cwd(), '..') : process.cwd()
  })
}

export const config = loadConfiguration()

export function validateAuthentication(configuration = config) {
  if (configuration.production && !configuration.jwtSecret) throw configurationError('JWT_SECRET must be configured in production')
  if (!/^(?:\d+(?:\.\d+)?\s*(?:ms|s|m|h|d|w|y)|\d+)$/.test(configuration.accessTokenTtl)) throw configurationError('ACCESS_TOKEN_TTL must be a valid duration')
}
