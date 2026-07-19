<script setup>
import { reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthPanel from '@/components/auth/AuthPanel.vue'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const form = reactive({ usernameOrEmail: 'user@csitsheet.app', password: 'User@1234' })

async function submit() {
  const user = await auth.login(form)
  const fallback = user.role === 'ADMIN' ? '/admin' : '/dashboard'
  router.push(route.query.redirect?.toString() || fallback)
}
</script>

<template>
  <AuthPanel title="เข้าสู่ระบบ" subtitle="ใช้บัญชีทดลอง user@csitsheet.app / User@1234 หรือ admin@csitsheet.app / Admin@1234" :error="auth.error">
    <form class="form" @submit.prevent="submit">
      <label>
        อีเมลหรือชื่อผู้ใช้
        <input v-model="form.usernameOrEmail" autocomplete="username" required />
      </label>
      <label>
        รหัสผ่าน
        <input v-model="form.password" type="password" autocomplete="current-password" required />
      </label>
      <button class="button button--primary button--wide" :disabled="auth.loading">
        {{ auth.loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
      </button>
      <RouterLink to="/register" class="text-link">สมัครสมาชิกใหม่</RouterLink>
    </form>
  </AuthPanel>
</template>
