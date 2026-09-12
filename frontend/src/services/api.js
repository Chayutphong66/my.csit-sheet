import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? '/api'

let accessToken = null
let refreshPromise = null

export function setAccessToken(token) {
  accessToken = token
}

export const apiClient = axios.create({
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
  async (error) => {
    const config = error.config
    const isAuthRoute = String(config?.url ?? '').startsWith('/auth/')
    if (error.response?.status === 401 && config && !config._retry && !config.skipAuthRefresh && !isAuthRoute) {
      config._retry = true
      refreshPromise ??= apiClient
        .post('/auth/refresh', null, { skipAuthRefresh: true })
        .then((response) => {
          setAccessToken(response.data.accessToken)
          return response.data.accessToken
        })
        .finally(() => {
          refreshPromise = null
        })
      try {
        const token = await refreshPromise
        config.headers.Authorization = `Bearer ${token}`
        return apiClient(config)
      } catch {
        setAccessToken(null)
      }
    }
    const message = error.response?.data?.message ?? error.message ?? 'Request failed'
    return Promise.reject(new Error(message))
  }
)

export async function request(config) {
  const response = await apiClient(config)
  return response.status === 204 ? null : response.data
}
