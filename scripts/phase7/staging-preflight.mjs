import { pathToFileURL } from 'node:url'
import { loadConfiguration, validateAuthentication } from '../../backend/src/config/environment.js'

const nonProduction = /(staging|test|qa)/i
const placeholder = /(replace|example\.invalid|change-me|your-)/i

export function validateStagingEnvironment(env) {
  if (env.STAGING_SAFETY_TOKEN !== 'ISOLATED-NON-PRODUCTION') throw new Error('STAGING_SAFETY_TOKEN must explicitly confirm an isolated environment')
  if (!nonProduction.test(env.STAGING_ENVIRONMENT_ID || '')) throw new Error('STAGING_ENVIRONMENT_ID must identify staging, test or QA')
  if (env.NODE_ENV !== 'production') throw new Error('Staging must exercise production security behavior with NODE_ENV=production')
  const configuration = loadConfiguration(env)
  validateAuthentication(configuration)
  if (configuration.databaseDriver !== 'postgres') throw new Error('Staging requires PostgreSQL')
  const databaseUrl = new URL(configuration.databaseUrl)
  if (!nonProduction.test(databaseUrl.pathname)) throw new Error('Staging database name must contain staging, test or qa')
  if (env.PRODUCTION_DATABASE_URL && env.PRODUCTION_DATABASE_URL === env.DATABASE_URL) throw new Error('Staging and production database URLs must differ')
  if (configuration.storageDriver !== 'supabase') throw new Error('Staging must verify the Supabase storage adapter')
  if (!nonProduction.test(configuration.storageBucket)) throw new Error('Staging storage bucket must contain staging, test or qa')
  if (env.PRODUCTION_SUPABASE_URL && env.PRODUCTION_SUPABASE_URL === env.SUPABASE_URL) throw new Error('Staging and production storage projects must differ')
  if (env.PRODUCTION_SUPABASE_STORAGE_BUCKET && env.PRODUCTION_SUPABASE_STORAGE_BUCKET === env.SUPABASE_STORAGE_BUCKET) throw new Error('Staging and production storage buckets must differ')
  if (!configuration.jwtSecret || configuration.jwtSecret.length < 32 || placeholder.test(configuration.jwtSecret)) throw new Error('Staging requires an independent non-placeholder JWT_SECRET of at least 32 characters')
  if (!configuration.appBaseUrl || !configuration.allowedOrigins.includes(configuration.appBaseUrl)) throw new Error('APP_BASE_URL must be included in ALLOWED_ORIGINS')
  if (env.VITE_API_URL !== '/api' && env.VITE_API_URL !== `${configuration.appBaseUrl}/api`) throw new Error('VITE_API_URL must use same-origin /api or the explicit staging API origin')
  return {
    environment: env.STAGING_ENVIRONMENT_ID,
    database: { driver: configuration.databaseDriver, host: databaseUrl.hostname, name: databaseUrl.pathname.slice(1) },
    storage: { driver: configuration.storageDriver, host: new URL(configuration.storageUrl).hostname, bucket: configuration.storageBucket },
    application: { origin: configuration.appBaseUrl, corsOrigins: configuration.allowedOrigins, cookieSameSite: configuration.cookieSameSite, cookieSecure: configuration.cookieSecure }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify({ status: 'ok', ...validateStagingEnvironment(process.env) }, null, 2))
}
