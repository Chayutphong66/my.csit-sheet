import { request } from '@/services/api'

export const contributorApi = {
  search: (query) => request({ url: `/contributors/search?q=${encodeURIComponent(query ?? '')}` }),
  profile: (username) => request({ url: `/contributors/${encodeURIComponent(username)}` }),
  star: (document, starred) => request({ url: `/contributors/stars/${document.documentType}/${encodeURIComponent(document.id)}`, method: 'PUT', data: { starred } }),
  edit: (profile) => request({ url: '/contributors/me', method: 'PATCH', data: profile }),
  settings: () => request({ url: '/contributors/me/settings' }),
  saveSettings: (data) => request({ url: '/contributors/me/settings', method: 'PATCH', data }),
  changeRequests: () => request({ url: '/contributors/me/change-requests' }),
  requestChange: (data) => request({ url: '/contributors/me/change-requests', method: 'POST', data }),
  follow: (username, following) => request({ url: `/contributors/${encodeURIComponent(username)}/follow`, method: 'PUT', data: { following } }),
  followers: (username) => request({ url: `/contributors/${encodeURIComponent(username)}/followers` }),
  following: (username) => request({ url: `/contributors/${encodeURIComponent(username)}/following` }),
  feed: (offset = 0) => request({ url: `/contributors/feed/following?offset=${offset}&limit=20` }),
  uploadAvatar: (fileData) => request({ url: '/contributors/me/avatar', method: 'POST', data: { fileData } }),
  removeAvatar: () => request({ url: '/contributors/me/avatar', method: 'DELETE' })
}
