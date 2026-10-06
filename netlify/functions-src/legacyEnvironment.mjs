// Transitional adapter only. Core configuration never detects a hosting provider.
export function configureLegacyEnvironment(env = process.env) {
  env.NODE_ENV ||= 'production'
  env.DATABASE_DRIVER ||= 'postgres'
  if (!env.DATABASE_URL && env.NETLIFY_DB_URL) env.DATABASE_URL = env.NETLIFY_DB_URL
  env.STORAGE_DRIVER ||= 'netlify'
  if (!env.ALLOWED_ORIGINS && (env.URL || env.FRONTEND_URL)) env.ALLOWED_ORIGINS = env.URL || env.FRONTEND_URL
}
configureLegacyEnvironment()
