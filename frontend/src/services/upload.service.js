import { apiClient, request } from '@/services/api'

// User-side document submission / upload-request flow.
export const uploadApi = {
  createUploadRequest: (data) =>
    request({ url: '/upload-requests', method: 'POST', data }),
  uploadRequests: () => request({ url: '/upload-requests' }),
  contributions: () => request({ url: '/upload-requests/contributions' }),
  uploadRequest: (id) => request({ url: `/upload-requests/${id}` }),
  downloadUploadRequestFile: (id) =>
    apiClient
      .get(`/upload-requests/${id}/file`, { responseType: 'blob' })
      .then((response) => response.data),
  downloadPublishedFile: (request) => {
    const path = request.documentType === 'Lecture'
      ? `/lectures/${request.publishedId}/download`
      : `/sheets/${request.publishedId}/download`
    return apiClient.get(path, { responseType: 'blob' }).then((response) => response.data)
  },
  completeUploadRequest: (id, data) =>
    request({ url: `/upload-requests/${id}/complete`, method: 'PATCH', data })
}
