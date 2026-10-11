import { apiClient, request } from '@/services/api'

export const collectionApi = {
  mine: () => request({ url: '/collections/mine' }),
  discover: (query = '', page = 1) => request({ url: `/collections/discover?q=${encodeURIComponent(query)}&page=${page}&limit=20` }),
  published: (slug) => request({ url: `/collections/published/${encodeURIComponent(slug)}` }),
  detail: (id) => request({ url: `/collections/${encodeURIComponent(id)}` }),
  create: (data) => request({ url: '/collections', method: 'POST', data }),
  update: (id, data) => request({ url: `/collections/${encodeURIComponent(id)}`, method: 'PATCH', data }),
  lifecycle: (id, action) => request({ url: `/collections/${encodeURIComponent(id)}/lifecycle/${action}`, method: 'POST' }),
  addSection: (id, title) => request({ url: `/collections/${encodeURIComponent(id)}/sections`, method: 'POST', data: { title } }),
  renameSection: (id, sectionId, title) => request({ url: `/collections/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}`, method: 'PATCH', data: { title } }),
  removeSection: (id, sectionId) => request({ url: `/collections/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}`, method: 'DELETE' }),
  addDocument: (id, data) => request({ url: `/collections/${encodeURIComponent(id)}/documents`, method: 'POST', data }),
  removeDocument: (id, document) => request({ url: `/collections/${encodeURIComponent(id)}/documents/${document.documentType}/${encodeURIComponent(document.documentId)}`, method: 'DELETE' }),
  saveOrder: (id, data) => request({ url: `/collections/${encodeURIComponent(id)}/order`, method: 'PUT', data }),
  uploadCover: (id, data) => request({ url: `/collections/${encodeURIComponent(id)}/cover`, method: 'POST', data }),
  removeCover: (id) => request({ url: `/collections/${encodeURIComponent(id)}/cover`, method: 'DELETE' }),
  coverUrl: (slug) => `${apiClient.defaults.baseURL}/collections/published/${encodeURIComponent(slug)}/cover`,
  readerFile: (slug, document) => apiClient.get(`/collections/published/${encodeURIComponent(slug)}/documents/${document.documentType.toLowerCase()}/${encodeURIComponent(document.documentId)}/view`, { responseType: 'blob' }).then(response => ({ blob: response.data, contentType: response.headers?.['content-type'] })),
  bulk: (data) => request({ url: '/collections/bulk-uploads', method: 'POST', data }),
  bulkJob: (id) => request({ url: `/collections/bulk-uploads/${encodeURIComponent(id)}` }),
  retry: (id, data) => request({ url: `/collections/bulk-uploads/${encodeURIComponent(id)}/retry`, method: 'POST', data })
}
