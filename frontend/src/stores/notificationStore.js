import { reactive } from 'vue'
import { userApi } from '@/services/user.service'

const state = reactive({
  items: [],
  loading: false,
  error: ''
})

export function useNotificationStore() {
  // Fetch notifications into shared state. Concurrent callers (e.g. the topbar
  // bell and the profile panel mounting together) dedupe on the in-flight flag —
  // whichever call wins populates the state both components reactively read.
  async function load() {
    if (state.loading) return
    state.loading = true
    state.error = ''
    try {
      state.items = (await userApi.notifications()) ?? []
    } catch (error) {
      state.error = error.message
    } finally {
      state.loading = false
    }
  }

  async function markRead(id) {
    const item = state.items.find((notification) => notification.id === id)
    if (!item || item.isRead) return
    await userApi.readNotification(id)
    item.isRead = true
  }

  function reset() {
    state.items = []
    state.error = ''
  }

  return {
    get items() {
      return state.items
    },
    get loading() {
      return state.loading
    },
    get error() {
      return state.error
    },
    get unreadCount() {
      return state.items.filter((notification) => !notification.isRead).length
    },
    load,
    markRead,
    reset
  }
}
