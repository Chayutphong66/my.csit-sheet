<script setup>
import { reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthPanel from '@/components/auth/AuthPanel.vue'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const form = reactive({ usernameOrEmail: '', password: '' })

async function submit() {
  const user = await auth.login(form)
  const fallback = user.role === 'ADMIN' ? '/admin' : '/dashboard'
  router.push(route.query.redirect?.toString() || fallback)
}
</script>

<template>
  <AuthPanel title="Welcome back" subtitle="Sign in with your CSIT Sheet account to browse, upload, and review learning material." :error="auth.error">
    <form class="form" @submit.prevent="submit">
      <label>
        Email or username
        <input v-model="form.usernameOrEmail" autocomplete="username" required placeholder="user@csitsheet.app" />
      </label>
      <label>
        Password
        <input v-model="form.password" type="password" autocomplete="current-password" required placeholder="Your password" />
      </label>
      <button class="button button--primary button--wide" :disabled="auth.loading">
        {{ auth.loading ? 'Signing in...' : 'Sign in' }}
      </button>
      <RouterLink to="/register" class="text-link">Create an account</RouterLink>
    </form>
  </AuthPanel>
</template>
