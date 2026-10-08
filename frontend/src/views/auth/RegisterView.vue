<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthPanel from '@/components/auth/AuthPanel.vue'
import { useAuthStore } from '@/stores/authStore'
import { PROGRAM_OPTIONS, cohortOptions } from '@/services/communityIdentity'

const auth = useAuthStore()
const router = useRouter()
const message = ref('')
const form = reactive({ displayName: '', username: '', email: '', password: '', confirmPassword: '', program: '', cohort: '' })
const cohorts = cohortOptions()

async function submit() {
  if (form.password !== form.confirmPassword) { auth.setError?.('Passwords do not match'); return }
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
      <label>
        ยืนยันรหัสผ่าน
        <input v-model="form.confirmPassword" type="password" required minlength="8" autocomplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง" />
        <small v-if="form.confirmPassword && form.password !== form.confirmPassword" class="form-error" role="alert">Passwords do not match</small>
      </label>
      <label>
        สาขา
        <select v-model="form.program" required>
          <option value="" disabled>เลือกสาขา</option>
          <option v-for="program in PROGRAM_OPTIONS" :key="program.value" :value="program.value">{{ program.label }}</option>
        </select>
      </label>
      <label>
        รุ่น
        <select v-model="form.cohort" required>
          <option value="" disabled>เลือกรุ่น</option>
          <option v-for="cohort in cohorts" :key="cohort" :value="cohort">รุ่น {{ cohort }}</option>
        </select>
      </label>
      <p v-if="message" class="form-success">{{ message }}</p>
      <button class="button button--primary button--wide" :disabled="auth.loading || form.password !== form.confirmPassword">
        {{ auth.loading ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชี' }}
      </button>
      <RouterLink to="/login" class="text-link">มีบัญชีอยู่แล้ว</RouterLink>
    </form>
  </AuthPanel>
</template>
