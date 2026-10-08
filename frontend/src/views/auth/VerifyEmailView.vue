<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AuthPanel from '@/components/auth/AuthPanel.vue'
import { authApi } from '@/services/auth.service'
const route = useRoute(); const message = ref('กำลังยืนยันอีเมล…'); const error = ref('')
onMounted(async () => { try { message.value = (await authApi.verifyEmail(String(route.query.token || ''))).message } catch (caught) { message.value = ''; error.value = caught.message } })
</script>
<template><AuthPanel title="ยืนยันอีเมล" subtitle="Email verification" :error="error"><p v-if="message" class="form-success" role="status">{{ message }}</p><RouterLink to="/login" class="button button--primary button--wide">เข้าสู่ระบบ</RouterLink></AuthPanel></template>
