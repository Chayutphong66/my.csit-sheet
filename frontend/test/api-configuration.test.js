import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

describe('central API configuration', () => {
  it('uses normal Express file endpoints and credentials with an external backend', async () => {
    vi.stubEnv('PROD', true); vi.stubEnv('VITE_API_URL', 'https://backend.example.invalid/api')
    const { apiClient, useNetlifyFiles } = await import('../src/services/api.js')
    expect(apiClient.defaults.baseURL).toBe('https://backend.example.invalid/api')
    expect(apiClient.defaults.withCredentials).toBe(true)
    expect(useNetlifyFiles).toBe(false)
  })
  it('retains the existing Netlify same-origin file adapter during transition', async () => {
    vi.stubEnv('PROD', true); vi.stubEnv('VITE_API_URL', '/api')
    const { useNetlifyFiles } = await import('../src/services/api.js')
    expect(useNetlifyFiles).toBe(true)
  })
})
