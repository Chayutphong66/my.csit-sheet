const SECRET_ENV_NAMES = [
  'JWT_SECRET',
  'NETLIFY_DB_URL',
  'DATABASE_URL',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TEST_DATABASE_URL',
  'NETLIFY_AUTH_TOKEN',
  'NETLIFY_BLOBS_CONTEXT'
]

function redact(value) {
  let text = String(value ?? '')
  for (const name of SECRET_ENV_NAMES) {
    const secret = process.env[name]
    if (secret && secret.length >= 6) text = text.split(secret).join(`[REDACTED_${name}]`)
  }
  return text
    .replace(/\b(?:postgres(?:ql)?):\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/\b(?:bearer\s+)[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/scrypt\$[^\s"'\\]+/g, '[REDACTED_PASSWORD_HASH]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]')
    .replace(/\b(password|secret|token|authorization|connectionString)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
}

function safeCode(error) {
  const code = String(error?.code ?? '')
  return /^[A-Za-z0-9_-]{1,40}$/.test(code) ? code : undefined
}

export function safeErrorDetails(error) {
  return {
    name: redact(error?.name || 'Error'),
    code: safeCode(error),
    message: redact(error?.message || 'Unknown server error'),
    stack: redact(error?.stack || '').split('\n').slice(0, 6).join('\n') || undefined
  }
}

export function databaseDiagnosticCode(error) {
  if (error?.code === 'CONFIGURATION_ERROR') return 'DATABASE_CONFIGURATION_MISSING'
  if (error?.name === 'MissingDatabaseConnectionError') return 'DATABASE_CONFIGURATION_MISSING'
  if (error?.code === 'SCHEMA_NOT_READY' || error?.code === '42P01') return 'DATABASE_SCHEMA_NOT_READY'
  if (error?.code === '28P01' || error?.code === '28000') return 'DATABASE_AUTHENTICATION_FAILED'
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '57P01'].includes(error?.code)) return 'DATABASE_CONNECTION_FAILED'
  return 'DATABASE_CHECK_FAILED'
}

export function logServerError(event, error, context = {}) {
  console.error(JSON.stringify({
    event,
    ...context,
    error: safeErrorDetails(error)
  }))
}
