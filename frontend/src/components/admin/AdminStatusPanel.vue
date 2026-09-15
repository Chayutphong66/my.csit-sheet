<script setup>
import { onMounted, ref } from 'vue'; import { adminApi } from '@/services/admin.service'; import UserIdentity from '@/components/shared/UserIdentity.vue'
const users = ref([]); const loading = ref(true); const error = ref('')
onMounted(async () => { try { users.value = await adminApi.adminUsers() } catch { error.value = 'โหลดรายชื่อผู้ใช้งานไม่สำเร็จ' } finally { loading.value = false } })
</script>
<template><section class="page-panel"><div class="panel__header"><div><p class="eyebrow">Community accounts</p><h1>ผู้ใช้งาน</h1><p>มุมมองสำหรับผู้ดูแลเท่านั้น ข้อมูลอีเมลจะไม่ถูกส่งผ่าน API โปรไฟล์สาธารณะ</p></div><span class="count-pill">{{ users.length }} บัญชี</span></div><div v-if="loading" class="loading-state">กำลังโหลด…</div><p v-else-if="error" class="form-error">{{ error }}</p><div v-else class="user-admin-list"><article v-for="user in users" :key="user.id"><UserIdentity :username="user.username" :display-name="user.displayName" :linked="false" /><div><span class="role-chip">{{ user.role }}</span><p>{{ user.email }}</p></div></article></div></section></template>
