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
  <AuthPanel title="สมัครสมาชิก" subtitle="สร้างบัญชีสำหรับอัปโหลดและติดตามชีทสรุปของคุณ" :error="auth.error">
    <form class="form" @submit.prevent="submit">
      <label>
        ชื่อผู้ใช้
        <input v-model="form.username" required minlength="3" />
      </label>
      <label>
        อีเมล
        <input v-model="form.email" type="email" required />
      </label>
      <label>
        รหัสผ่าน
        <input v-model="form.password" type="password" required minlength="6" />
      </label>
      <p v-if="message" class="form-success">{{ message }}</p>
      <button class="button button--primary button--wide" :disabled="auth.loading">
        {{ auth.loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก' }}
      </button>
      <RouterLink to="/login" class="text-link">มีบัญชีอยู่แล้ว</RouterLink>
    </form>
  </AuthPanel>
</template>
