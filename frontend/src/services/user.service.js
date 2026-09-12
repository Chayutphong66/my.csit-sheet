import { request } from '@/services/api'

// User-specific operations (notifications).
export const userApi = {
  notifications: () => request({ url: '/notifications' }),
  readNotification: (id) =>
    request({ url: `/notifications/${id}/read`, method: 'PATCH' })
}
