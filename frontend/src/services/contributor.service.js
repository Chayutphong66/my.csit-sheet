import { request } from '@/services/api'

export const contributorApi = {
  search: (query) => request({ url: `/contributors/search?q=${encodeURIComponent(query ?? '')}` }),
  profile: (username) => request({ url: `/contributors/${encodeURIComponent(username)}` })
}
