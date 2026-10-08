<script setup>
import { reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import AuthPanel from '@/components/auth/AuthPanel.vue'
import { authApi } from '@/services/auth.service'
const route = useRoute(); const form = reactive({ password: '', confirmPassword: '' }); const message = ref(''); const error = ref(''); const busy = ref(false)
async function submit() { if (form.password !== form.confirmPassword) { error.value = 'Passwords do not match'; return } busy.value = true; error.value = ''; try { message.value = (await authApi.resetPassword({ token: String(route.query.token || ''), ...form })).message } catch (caught) { error.value = caught.message } finally { busy.value = false } }
</script>
<template><AuthPanel title="ตั้งรหัสผ่านใหม่" subtitle="Reset password" :error="error"><form class="form" @submit.prevent="submit"><label>รหัสผ่านใหม่<input v-model="form.password" type="password" autocomplete="new-password" minlength="8" required /></label><label>ยืนยันรหัสผ่านใหม่<input v-model="form.confirmPassword" type="password" autocomplete="new-password" minlength="8" required /></label><p v-if="message" class="form-success" role="status">{{ message }} <RouterLink to="/login">เข้าสู่ระบบ</RouterLink></p><button class="button button--primary button--wide" :disabled="busy || form.password !== form.confirmPassword">บันทึกรหัสผ่าน</button></form></AuthPanel></template>
