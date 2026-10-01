import { apiClient, request, requestWithChunkedFile } from '@/services/api'

// User-side document submission / upload-request flow.
export const uploadApi = {
  checkDuplicates: (data) =>
    requestWithChunkedFile({ url: '/upload-requests/duplicate-check', method: 'POST', data }),
  createUploadRequest: (data) =>
    requestWithChunkedFile({ url: '/upload-requests', method: 'POST', data }),
  uploadRequests: () => request({ url: '/upload-requests' }),
  contributions: () => request({ url: '/upload-requests/contributions' }),
  uploadRequest: (id) => request({ url: `/upload-requests/${id}` }),
  downloadUploadRequestFile: (id) =>
    apiClient
      .get(import.meta.env.PROD ? `/blob/request/${encodeURIComponent(id)}/download` : `/upload-requests/${id}/file`, { responseType: 'blob' })
      .then((response) => response.data),
  downloadPublishedFile: (request) => {
    const path = import.meta.env.PROD
      ? `/blob/${request.documentType.toLowerCase()}/${encodeURIComponent(request.publishedId)}/download`
      : request.documentType === 'Lecture'
        ? `/lectures/${request.publishedId}/download`
        : `/sheets/${request.publishedId}/download`
    return apiClient.get(path, { responseType: 'blob' }).then((response) => response.data)
  },
  completeUploadRequest: (id, data) =>
    request({ url: `/upload-requests/${id}/complete`, method: 'PATCH', data })
}
