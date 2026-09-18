import { request } from '@/services/api'

export const contributorApi = {
  search: (query) => request({ url: `/contributors/search?q=${encodeURIComponent(query ?? '')}` }),
  profile: (username) => request({ url: `/contributors/${encodeURIComponent(username)}` }),
  star: (document, starred) => request({ url: `/contributors/stars/${document.documentType}/${encodeURIComponent(document.id)}`, method: 'PUT', data: { starred } }),
  edit: (displayName) => request({ url: '/contributors/me', method: 'PATCH', data: { displayName } })
}
