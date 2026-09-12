import { apiClient, request } from '@/services/api'

function filenameFromDisposition(disposition) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) return decodeURIComponent(encoded)

  const plain = disposition?.match(/filename="?([^";]+)"?/i)?.[1]
  return plain ? plain.trim() : ''
}

function downloadResponse(response) {
  return {
    blob: response.data,
    fileName: filenameFromDisposition(response.headers?.['content-disposition'])
  }
}

// Course / subject / sheet retrieval, plus lecture-material retrieval.
export const sheetApi = {
  mine: () => request({ url: '/sheets/mine' }),
  all: () => request({ url: '/sheets/all' }),
  metadata: () => request({ url: '/sheets/metadata' }),
  catalog: (type) => request({ url: `/sheets/catalog?type=${encodeURIComponent(type ?? '')}` }),
  // Download an approved sheet's stored file (available to any signed-in user).
  downloadFile: (id) =>
    apiClient.get(`/sheets/${id}/download`, { responseType: 'blob' }).then(downloadResponse)
}

export const lectureApi = {
  all: () => request({ url: '/lectures' }),
  one: (id) => request({ url: `/lectures/${id}` }),
  // Download an approved lecture's stored file (available to any signed-in user).
  downloadFile: (id) =>
    apiClient.get(`/lectures/${id}/download`, { responseType: 'blob' }).then(downloadResponse)
}
