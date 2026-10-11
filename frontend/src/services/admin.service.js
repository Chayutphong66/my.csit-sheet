import { apiClient, request, requestWithChunkedFile, useNetlifyFiles } from '@/services/api'

// Admin operations: user management, document management, approval / rejection.
export const adminApi = {
  adminUploadRequests: (status = '') => request({ url: `/admin/upload-requests${status ? `?status=${encodeURIComponent(status)}` : ''}` }),
  adminDownloadUploadRequestFile: (id) =>
    apiClient
      .get(useNetlifyFiles ? `/blob/request/${encodeURIComponent(id)}/view` : `/admin/upload-requests/${id}/file`, { responseType: 'blob' })
      .then((response) => response.data),
  publicDocumentFile: (match, action = 'view') =>
    apiClient
      .get(useNetlifyFiles ? `/blob/${match.documentType.toLowerCase()}/${encodeURIComponent(match.publicDocumentId)}/${action}` : `/documents/${match.documentType.toLowerCase()}/${match.publicDocumentId}/${action}`, { responseType: 'blob' })
      .then((response) => response.data),
  adminUsers: ({ search = '', status = '', page = 1, limit = 20 } = {}) => request({ url: `/admin/users?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${page}&limit=${limit}` }),
  adminUser: (id) => request({ url: `/admin/users/${encodeURIComponent(id)}` }),
  updateAdminUser: (id, data) => request({ url: `/admin/users/${encodeURIComponent(id)}`, method: 'PATCH', data }),
  updateAdminUserStatus: (id, status, reason = '') => request({ url: `/admin/users/${encodeURIComponent(id)}/status`, method: 'PATCH', data: { status, reason } }),
  adminAuditLogs: ({ targetUserId = '', page = 1, limit = 20 } = {}) => request({ url: `/admin/audit-logs?targetUserId=${encodeURIComponent(targetUserId)}&page=${page}&limit=${limit}` }),
  collections: (status = '') => request({ url: `/admin/collections${status ? `?status=${encodeURIComponent(status)}` : ''}` }),
  collection: (id) => request({ url: `/admin/collections/${encodeURIComponent(id)}` }),
  createCollection: (data) => request({ url: '/admin/collections', method: 'POST', data }),
  updateCollection: (id, data) => request({ url: `/admin/collections/${encodeURIComponent(id)}`, method: 'PATCH', data }),
  createBulkUpload: (data) => request({ url: '/admin/bulk-uploads', method: 'POST', data }),
  bulkUpload: (id) => request({ url: `/admin/bulk-uploads/${encodeURIComponent(id)}` }),
  retryBulkUpload: (id, items) => request({ url: `/admin/bulk-uploads/${encodeURIComponent(id)}/retry`, method: 'POST', data: { items } }),
  profileChangeRequests: (status = '') => request({ url: `/admin/profile-change-requests${status ? `?status=${encodeURIComponent(status)}` : ''}` }),
  decideProfileChangeRequest: (id, status, reason = '') => request({ url: `/admin/profile-change-requests/${encodeURIComponent(id)}`, method: 'PATCH', data: { status, reason } }),
  adminCreateUploadRequest: (data) =>
    requestWithChunkedFile({ url: '/admin/upload-requests', method: 'POST', data }),
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
  previewCourseImport: (data) => requestWithChunkedFile({ url: '/admin/course-imports/preview', method: 'POST', data }),
  confirmCourseImport: (data) => requestWithChunkedFile({ url: '/admin/course-imports/confirm', method: 'POST', data }),
  courseImportHistory: () => request({ url: '/admin/course-imports' }),
  revisions: (status = '') => request({ url: `/admin/revisions?status=${encodeURIComponent(status)}` }),
  revisionFile: (id) => apiClient.get(useNetlifyFiles ? `/blob/version/${encodeURIComponent(id)}/view` : `/admin/revisions/${encodeURIComponent(id)}/file`, { responseType: 'blob' }).then(response => response.data),
  approveRevision: (id) => request({ url: `/admin/revisions/${encodeURIComponent(id)}/approve`, method: 'PATCH' }),
  rejectRevision: (id, reason) => request({ url: `/admin/revisions/${encodeURIComponent(id)}/reject`, method: 'PATCH', data: { reason } }),
  restoreVersion: (document, versionId) => request({ url: `/admin/documents/${document.documentType.toLowerCase()}/${encodeURIComponent(document.id)}/restore/${encodeURIComponent(versionId)}`, method: 'POST' }),
  approve: (id) => request({ url: `/admin/sheets/${id}/approve`, method: 'PATCH' }),
  reject: (id, reason) =>
    request({
      url: `/admin/sheets/${id}/reject`,
      method: 'PATCH',
      data: { reason }
    }),
  teachers: (search = '') => request({ url: `/admin/teachers?search=${encodeURIComponent(search)}` }),
  createTeacher: (data) => request({ url: '/admin/teachers', method: 'POST', data }),
  updateTeacher: (id, data) => request({ url: `/admin/teachers/${encodeURIComponent(id)}`, method: 'PATCH', data }),
  teacherOfferings: (id) => request({ url: `/admin/teachers/${encodeURIComponent(id)}/offerings` }),
  offerings: () => request({ url: '/admin/course-offerings' }),
  saveOffering: (data) => request({ url: '/admin/course-offerings', method: 'PUT', data }),
  teacherSuggestions: (status = '') => request({ url: `/admin/teacher-suggestions?status=${encodeURIComponent(status)}` }),
  decideTeacherSuggestion: (id, decision, reason = '') => request({ url: `/admin/teacher-suggestions/${encodeURIComponent(id)}`, method: 'PATCH', data: { decision: typeof decision === 'boolean' ? (decision ? 'APPROVE_GLOBAL' : 'REJECT') : decision, reason } })
}
