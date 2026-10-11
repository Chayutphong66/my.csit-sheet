const baseValue = process.env.STAGING_BASE_URL || process.env.APP_BASE_URL
if (process.env.RUN_STAGING_SMOKE !== 'true' || process.env.STAGING_SAFETY_TOKEN !== 'ISOLATED-NON-PRODUCTION') {
  throw new Error('Staging smoke checks require RUN_STAGING_SMOKE=true and the isolated-environment safety token')
}
const base = new URL(baseValue)
if (base.protocol !== 'https:' || !/(staging|test|qa)/i.test(base.hostname)) throw new Error('STAGING_BASE_URL must be an HTTPS non-production hostname')

const health = await fetch(new URL('/api/health', base), { headers: { origin: base.origin }, signal: AbortSignal.timeout(15000) })
const healthBody = await health.json().catch(() => null)
if (health.status !== 200 || healthBody?.status !== 'ok' || healthBody?.database !== 'ready') throw new Error('Staging health/database check failed')
const missing = await fetch(new URL('/api/phase7-route-probe', base), { headers: { origin: base.origin }, signal: AbortSignal.timeout(15000) })
if (missing.status !== 404 || !String(missing.headers.get('content-type')).includes('application/json')) throw new Error('Staging API routing check failed')
const denied = await fetch(new URL('/api/health', base), { headers: { origin: 'https://phase7-untrusted.invalid' }, signal: AbortSignal.timeout(15000) })
if (denied.status !== 403) throw new Error('Staging CORS rejection check failed')
const frontend = await fetch(base, { signal: AbortSignal.timeout(15000) })
if (frontend.status !== 200 || !String(frontend.headers.get('content-type')).includes('text/html')) throw new Error('Staging static frontend check failed')
console.log(JSON.stringify({ status: 'ok', health: health.status, apiRouting: missing.status, corsDenied: denied.status, staticAssets: frontend.status }))
