<script setup>
import { ref } from 'vue'
import AuthPanel from '@/components/auth/AuthPanel.vue'
import { authApi } from '@/services/auth.service'
const email = ref(''); const message = ref(''); const error = ref(''); const busy = ref(false)
async function submit() { busy.value = true; error.value = ''; try { message.value = (await authApi.forgotPassword(email.value)).message } catch (caught) { error.value = caught.message } finally { busy.value = false } }
</script>
<template><AuthPanel title="ลืมรหัสผ่าน" subtitle="Forgot password" :error="error"><form class="form" @submit.prevent="submit"><label>Email<input v-model="email" type="email" autocomplete="email" required /></label><p v-if="message" class="form-success" role="status">{{ message }}</p><button class="button button--primary button--wide" :disabled="busy">ส่งลิงก์รีเซ็ต</button><RouterLink to="/login" class="text-link">กลับไปหน้าเข้าสู่ระบบ</RouterLink></form></AuthPanel></template>
