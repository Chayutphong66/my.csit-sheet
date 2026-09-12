import { request, setAccessToken } from '@/services/api'

export const authApi = {
  async login(credentials) {
    const data = await request({
      url: '/auth/login',
      method: 'POST',
      data: credentials
    })
    setAccessToken(data.accessToken)
    return data
  },
  register(credentials) {
    return request({
      url: '/auth/register',
      method: 'POST',
      data: credentials
    })
  },
  async refresh() {
    try {
      const data = await request({ url: '/auth/refresh', method: 'POST' })
      setAccessToken(data.accessToken)
      return data
    } catch {
      setAccessToken(null)
      return null
    }
  },
  async logout() {
    await request({ url: '/auth/logout', method: 'POST' }).catch(() => null)
    setAccessToken(null)
  }
}
