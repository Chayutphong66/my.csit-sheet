import { apiClient, request } from '@/services/api'

function fileResponse(response) {
  return { blob: response.data, contentType: response.headers?.['content-type'] }
}

export const documentApi = {
  courses: (type = '') => request({ url: `/courses?type=${encodeURIComponent(type)}` }),
  courseYears: (id, type = '') => request({ url: `/courses/${encodeURIComponent(id)}/years?type=${encodeURIComponent(type)}` }),
  courseYear: (id, year, type = '') => request({ url: `/courses/${encodeURIComponent(id)}/years/${encodeURIComponent(year)}?type=${encodeURIComponent(type)}` }),
  search: (query, type = '') => request({ url: `/documents/search?q=${encodeURIComponent(query ?? '')}&type=${encodeURIComponent(type)}` }),
  helpful: (document, helpful) => request({
    url: `/documents/${document.documentType.toLowerCase()}/${document.id}/helpful`,
    method: 'PUT',
    data: { helpful }
  }),
  view: (document) => apiClient.get(`/documents/${document.documentType.toLowerCase()}/${document.id}/view`, { responseType: 'blob' }).then(fileResponse),
  download: (document) => apiClient.get(`/documents/${document.documentType.toLowerCase()}/${document.id}/download`, { responseType: 'blob' }).then(fileResponse)
}

export function openDocumentBlob(blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export function downloadDocumentBlob(blob, fileName = 'document') {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
