import { apiClient, request } from '@/services/api'

// Admin operations: user management, document management, approval / rejection.
export const adminApi = {
  adminUploadRequests: () => request({ url: '/admin/upload-requests' }),
  adminDownloadUploadRequestFile: (id) =>
    apiClient
      .get(`/admin/upload-requests/${id}/file`, { responseType: 'blob' })
      .then((response) => response.data),
  adminUsers: () => request({ url: '/admin/users' }),
  adminCreateUploadRequest: (data) =>
    request({ url: '/admin/upload-requests', method: 'POST', data }),
  approveUploadRequest: (id, data) =>
    request({ url: `/admin/upload-requests/${id}/approve`, method: 'PATCH', data }),
  rejectUploadRequest: (id, reason) =>
    request({
      url: `/admin/upload-requests/${id}/reject`,
      method: 'PATCH',
      data: { reason }
    }),
  rejectDuplicateUploadRequest: (id, reason = 'Duplicate material') =>
    request({ url: `/admin/upload-requests/${id}/reject-duplicate`, method: 'PATCH', data: { reason } }),
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
