<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthPanel from '@/components/auth/AuthPanel.vue'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const message = ref('')
const form = reactive({ displayName: '', username: '', email: '', password: '' })

async function submit() {
  const data = await auth.register(form)
  message.value = data.message
  setTimeout(() => router.push('/login'), 700)
}
</script>

<template>
  <AuthPanel title="สร้างบัญชี" subtitle="สมัครเพื่อแบ่งปันเอกสารและติดตามผลการตรวจสอบจากผู้ดูแล" :error="auth.error">
    <form class="form" @submit.prevent="submit">
      <label>
        ชื่อที่แสดง
        <input v-model="form.displayName" required minlength="2" maxlength="80" autocomplete="name" placeholder="เช่น สมชาย ใจแบ่งปัน" />
      </label>
      <label>
        Username
        <input v-model="form.username" required minlength="3" placeholder="student01" />
      </label>
      <label>
        Email
        <input v-model="form.email" type="email" required placeholder="student@nu.ac.th" />
      </label>
      <label>
        รหัสผ่าน
        <input v-model="form.password" type="password" required minlength="8" autocomplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" />
      </label>
      <p v-if="message" class="form-success">{{ message }}</p>
      <button class="button button--primary button--wide" :disabled="auth.loading">
        {{ auth.loading ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชี' }}
      </button>
      <RouterLink to="/login" class="text-link">มีบัญชีอยู่แล้ว</RouterLink>
    </form>
  </AuthPanel>
</template>
