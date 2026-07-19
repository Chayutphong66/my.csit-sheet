import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? '/api'

let accessToken = null

export function setAccessToken(token) {
  accessToken = token
}

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message ?? error.message ?? 'Request failed'
    return Promise.reject(new Error(message))
  }
)

async function request(config) {
  const response = await apiClient(config)
  return response.status === 204 ? null : response.data
}

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

export const sheetApi = {
  mine: () => request({ url: '/sheets/mine' }),
  pending: () => request({ url: '/admin/sheets/pending' }),
  stats: () => request({ url: '/admin/stats' }),
  approve: (id) => request({ url: `/admin/sheets/${id}/approve`, method: 'PATCH' }),
  reject: (id, reason) =>
    request({
      url: `/admin/sheets/${id}/reject`,
      method: 'PATCH',
      data: { reason }
    })
}
