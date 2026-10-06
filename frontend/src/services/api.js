import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? '/api'
// Transitional Netlify file endpoints apply only to its same-origin backend.
// A configured external Express API always uses its normal document endpoints.
export const useNetlifyFiles = import.meta.env.PROD && !/^https?:\/\//i.test(API_URL)

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

const INLINE_FILE_BYTES = 2 * 1024 * 1024
const CHUNK_BYTES = 2 * 1024 * 1024
const CHUNK_BASE64_CHARACTERS = Math.floor(CHUNK_BYTES / 3) * 4

export async function requestWithChunkedFile(config) {
  const data = config.data || {}
  const base64 = String(data.fileData || '').replace(/^data:[^;]*;base64,/, '')
  const estimatedBytes = Number(data.fileSize) || Math.floor(base64.length * 3 / 4)
  if (!base64 || estimatedBytes <= INLINE_FILE_BYTES) return request(config)

  if (!data.uploadSessionId) {
    const totalChunks = Math.ceil(base64.length / CHUNK_BASE64_CHARACTERS)
    const session = await request({
      url: '/upload-sessions', method: 'POST',
      data: { fileName: data.fileName, fileType: data.fileType, fileSize: estimatedBytes, totalChunks }
    })
    for (let index = 0; index < totalChunks; index += 1) {
      await request({
        url: `/upload-sessions/${encodeURIComponent(session.id)}/chunks/${index}`,
        method: 'PUT',
        data: { data: base64.slice(index * CHUNK_BASE64_CHARACTERS, (index + 1) * CHUNK_BASE64_CHARACTERS) }
      })
    }
    data.uploadSessionId = session.id
  }
  const { fileData: _fileData, ...stagedData } = data
  return request({ ...config, data: stagedData })
}
