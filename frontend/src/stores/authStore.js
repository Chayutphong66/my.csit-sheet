import { reactive } from 'vue'
import { authApi } from '@/services/auth.service'

const state = reactive({
  ready: false,
  user: null,
  loading: false,
  error: ''
})

export function useAuthStore() {
  async function login(credentials) {
    state.loading = true
    state.error = ''
    try {
      const data = await authApi.login(credentials)
      state.user = data.user
      return data.user
    } catch (error) {
      state.error = error.message
      throw error
    } finally {
      state.loading = false
      state.ready = true
    }
  }

  async function register(credentials) {
    state.loading = true
    state.error = ''
    try {
      return await authApi.register(credentials)
    } catch (error) {
      state.error = error.message
      throw error
    } finally {
      state.loading = false
    }
  }

  async function refresh() {
    const data = await authApi.refresh()
    state.user = data?.user ?? null
    state.ready = true
    return state.user
  }

  async function logout() {
    await authApi.logout()
    state.user = null
  }

  return {
    get ready() {
      return state.ready
    },
    get user() {
      return state.user
    },
    get loading() {
      return state.loading
    },
    get error() {
      return state.error
    },
    login,
    register,
    refresh,
    logout
  }
}
