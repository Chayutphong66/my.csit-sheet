export function assertIsolatedPostgresUrl(value, label) {
  if (!value) throw new Error(`${label} is required`)
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error(`${label} must be PostgreSQL`)
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error(`${label} must use an isolated local/service-container host`)
  if (!/test/i.test(url.pathname)) throw new Error(`${label} database name must contain test`)
  return url
}
