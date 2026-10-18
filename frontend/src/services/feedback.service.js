import { request } from '@/services/api'

function queryString(filters = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value !== '' && value != null) params.set(key, value)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const feedbackApi = {
  submit: data => request({ url: '/feedback', method: 'POST', data }),
  mine: filters => request({ url: `/feedback/me${queryString(filters)}` }),
  detail: reference => request({ url: `/feedback/${encodeURIComponent(reference)}` }),
  adminList: filters => request({ url: `/admin/feedback${queryString(filters)}` }),
  adminDetail: reference => request({ url: `/admin/feedback/${encodeURIComponent(reference)}` }),
  adminUpdate: (reference, data) => request({ url: `/admin/feedback/${encodeURIComponent(reference)}`, method: 'PATCH', data })
}
