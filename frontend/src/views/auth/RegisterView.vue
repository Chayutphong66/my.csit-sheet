<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthPanel from '@/components/auth/AuthPanel.vue'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const message = ref('')
const form = reactive({ username: '', email: '', password: '' })

async function submit() {
  const data = await auth.register(form)
  message.value = data.message
  setTimeout(() => router.push('/login'), 700)
}
</script>

<template>
  <AuthPanel title="Create account" subtitle="Register to submit study material and track administrator review decisions." :error="auth.error">
    <form class="form" @submit.prevent="submit">
      <label>
        Username
        <input v-model="form.username" required minlength="3" placeholder="student01" />
      </label>
      <label>
        Email
        <input v-model="form.email" type="email" required placeholder="student@nu.ac.th" />
      </label>
      <label>
        Password
        <input v-model="form.password" type="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters" />
      </label>
      <p v-if="message" class="form-success">{{ message }}</p>
      <button class="button button--primary button--wide" :disabled="auth.loading">
        {{ auth.loading ? 'Creating account...' : 'Create account' }}
      </button>
      <RouterLink to="/login" class="text-link">I already have an account</RouterLink>
    </form>
  </AuthPanel>
</template>
