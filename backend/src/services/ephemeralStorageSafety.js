const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

function safetyError(message) {
  const error = new Error(message)
  error.code = 'EPHEMERAL_STORAGE_SAFETY_ERROR'
  return error
}
function requireUnset(env, names) {
  for (const name of names) {
    if (String(env[name] || '').trim()) throw safetyError(`${name} is prohibited in local-ephemeral mode`)
  }
}
export function validateLocalEphemeralStorageEnvironment(env = process.env) {
  if (env.EXTERNAL_STORAGE_TEST_MODE !== 'local-ephemeral') {
    throw safetyError('EXTERNAL_STORAGE_TEST_MODE must be local-ephemeral')
  }
  if (env.EXTERNAL_STORAGE_CREDENTIAL_SOURCE !== 'supabase-local-status') {
    throw safetyError('Local credentials must come directly from supabase status')
  }
  if (env.NODE_ENV !== 'test') throw safetyError('local-ephemeral mode requires NODE_ENV=test')
  if (env.DATABASE_DRIVER !== 'sqlite') throw safetyError('local-ephemeral mode requires DATABASE_DRIVER=sqlite')
  if (env.STORAGE_DRIVER !== 'supabase') throw safetyError('local-ephemeral mode requires STORAGE_DRIVER=supabase')

  requireUnset(env, [
    'DATABASE_URL', 'TEST_DATABASE_URL', 'PRODUCTION_DATABASE_URL', 'STAGING_DATABASE_URL',
    'TEST_SUPABASE_URL', 'TEST_SUPABASE_SECRET_KEY', 'TEST_SUPABASE_STORAGE_BUCKET', 'TEST_SUPABASE_PROJECT_REF',
    'PRODUCTION_SUPABASE_URL', 'PRODUCTION_SUPABASE_SECRET_KEY', 'PRODUCTION_SUPABASE_STORAGE_BUCKET',
    'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_ID', 'SUPABASE_DB_PASSWORD'
  ])

  let storageUrl
  try { storageUrl = new URL(env.SUPABASE_URL) } catch { throw safetyError('SUPABASE_URL must be a valid local URL') }
  if (storageUrl.protocol !== 'http:' || !LOOPBACK_HOSTS.has(storageUrl.hostname) || storageUrl.username || storageUrl.password || storageUrl.pathname !== '/' || storageUrl.search || storageUrl.hash) {
    throw safetyError('local-ephemeral storage must use an HTTP loopback origin')
  }

  const storageKey = String(env.SUPABASE_SECRET_KEY || '')
  if (!storageKey) throw safetyError('A Supabase local-stack key is required')
  const storageBucket = String(env.SUPABASE_STORAGE_BUCKET || '')
  if (!/^[a-z0-9][a-z0-9.-]{2,62}$/.test(storageBucket) || !/(?:test|phase7b)/.test(storageBucket) || storageBucket === 'documents') {
    throw safetyError('The local bucket must be test-named and must not be documents')
  }
  const runId = String(env.EXTERNAL_STORAGE_RUN_ID || '')
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(runId)) throw safetyError('EXTERNAL_STORAGE_RUN_ID is invalid')
  const storagePrefix = String(env.SUPABASE_STORAGE_PREFIX || '')
  if (storagePrefix !== `phase7b/${runId}`) throw safetyError('SUPABASE_STORAGE_PREFIX must be scoped to the current Phase 7B run')

  return Object.freeze({ storageUrl: storageUrl.origin, storageKey, storageBucket, storagePrefix, runId })
}
