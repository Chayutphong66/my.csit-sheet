<script setup>
import { onMounted } from 'vue'
import { useNotificationStore } from '@/stores/notificationStore'
const notifications = useNotificationStore()
onMounted(() => notifications.load())
</script>
<template>
  <section class="notifications-section"><div class="section-heading"><h2>การแจ้งเตือน</h2><span v-if="notifications.unreadCount" class="notification-badge">{{ notifications.unreadCount }} ยังไม่อ่าน</span></div><p v-if="notifications.loading" class="loading-state">กำลังโหลดการแจ้งเตือน…</p><p v-else-if="notifications.error" class="form-error" role="alert">{{ notifications.error }}</p><div v-else-if="notifications.items.length" class="notification-list"><article v-for="notification in notifications.items" :key="notification.id" class="notification-card" :class="{ 'notification-card--unread': !notification.isRead }"><div><h3>{{ notification.title }}</h3><p>{{ notification.message }}</p><small>{{ new Date(notification.createdAt).toLocaleDateString('th-TH') }}</small></div><button class="button button--ghost button--small" :disabled="notification.isRead" @click="notifications.markRead(notification.id)">{{ notification.isRead ? 'อ่านแล้ว' : 'ทำเครื่องหมายว่าอ่านแล้ว' }}</button></article></div><div v-else class="empty-state empty-state--compact">ยังไม่มีการแจ้งเตือน</div></section>
</template>
