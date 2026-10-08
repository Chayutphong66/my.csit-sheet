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
  <AuthPanel title="ยินดีต้อนรับกลับมา" subtitle="เข้าสู่ระบบเพื่อค้นหา ใช้งาน และแบ่งปันเอกสารกับชุมชน CSIT" :error="auth.error">
    <form class="form" @submit.prevent="submit">
      <label>
        อีเมลหรือ username
        <input v-model="form.usernameOrEmail" autocomplete="username" required placeholder="user@csitsheet.app" />
      </label>
      <RouterLink to="/forgot-password" class="text-link">ลืมรหัสผ่าน? · Forgot password</RouterLink>
      <label>
        รหัสผ่าน
        <input v-model="form.password" type="password" autocomplete="current-password" required placeholder="กรอกรหัสผ่าน" />
      </label>
      <button class="button button--primary button--wide" :disabled="auth.loading">
        {{ auth.loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ' }}
      </button>
      <RouterLink to="/register" class="text-link">สร้างบัญชีใหม่</RouterLink>
    </form>
  </AuthPanel>
</template>
