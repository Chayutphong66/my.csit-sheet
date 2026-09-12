<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { uploadApi } from '@/services/upload.service'

const auth = useAuthStore()
const notifications = useNotificationStore()
const contributions = ref({ total: 0, lectures: 0, sheets: 0, published: 0, pending: 0, rejected: 0, recent: [] })
const contributionLoading = ref(true)
const contributionError = ref('')
const initials = computed(() => String(auth.user?.username || 'U').slice(0, 2).toUpperCase())

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(() => {
  notifications.load()
  uploadApi.contributions()
    .then((value) => { contributions.value = value })
    .catch(() => { contributionError.value = 'Unable to load contributions.' })
    .finally(() => { contributionLoading.value = false })
})

function contributionStatus(status) {
  if (status === 'COMPLETED') return 'Published'
  if (['PENDING', 'PROCESSING', 'APPROVED'].includes(status)) return 'Pending'
  return status === 'FAILED' ? 'Rejected' : String(status || '').toLowerCase().replace(/^./, (letter) => letter.toUpperCase())
}

function contributionRoute(item) {
  return item.status === 'COMPLETED' && item.courseId && item.academicYear
    ? `/dashboard/courses/${item.courseId}/years/${item.academicYear}`
    : { path: '/dashboard/upload', query: { request: item.id } }
}
</script>

<template>
  <section class="page-panel">
    <div class="panel__header">
      <div>
        <p class="eyebrow">Profile</p>
        <h1>Profile</h1>
        <p>Review your account information and academic contributions.</p>
      </div>
    </div>

    <div class="profile-grid">
      <div class="profile-avatar"><img v-if="auth.user?.avatarUrl" :src="auth.user.avatarUrl" alt="Profile picture" /><strong v-else>{{ initials }}</strong></div>
      <div><span>Username</span><strong>{{ auth.user?.username }}</strong></div>
      <div><span>Email</span><strong>{{ auth.user?.email }}</strong></div>
      <div><span>Role</span><strong>{{ auth.user?.role }}</strong></div>
    </div>

    <div class="profile-section">
      <div class="panel__header">
        <div>
          <p class="eyebrow">Activity</p>
          <h2>My Contributions</h2>
          <p>Each submission is counted once throughout review and publication.</p>
        </div>
      </div>
      <div v-if="contributionLoading" class="loading-state">Loading contributions...</div>
      <p v-else-if="contributionError" class="form-error">{{ contributionError }}</p>
      <template v-else>
        <div class="profile-grid contribution-stats">
          <div><span>Total Contributions</span><strong>{{ contributions.total }}</strong></div>
          <div><span>Lectures</span><strong>{{ contributions.lectures }}</strong></div>
          <div><span>Sheets</span><strong>{{ contributions.sheets }}</strong></div>
          <div><span>Published</span><strong>{{ contributions.published }}</strong></div>
          <div><span>Pending</span><strong>{{ contributions.pending }}</strong></div>
          <div><span>Rejected</span><strong>{{ contributions.rejected }}</strong></div>
        </div>
        <div v-if="contributions.recent.length" class="request-list">
          <RouterLink v-for="item in contributions.recent" :key="item.id" class="request-card" :to="contributionRoute(item)">
            <div class="request-card__main"><span class="status" :class="`status--${item.status.toLowerCase()}`">{{ contributionStatus(item.status) }}</span><h3>{{ item.title }}</h3><p>{{ item.documentType }} · {{ item.courseName }} · {{ item.academicYear }} · Semester {{ item.semester }}</p></div>
          </RouterLink>
        </div>
        <div v-else class="empty-state"><h3>No contributions yet</h3><p>Your submitted Lectures and Sheets will appear here.</p><RouterLink class="button button--primary" to="/dashboard/upload">Upload material</RouterLink></div>
      </template>
    </div>

    <div class="notifications-section">
      <div class="notifications-head">
        <span class="notifications-bell" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>
          <span v-if="notifications.unreadCount" class="notifications-bell__dot"></span>
        </span>
        <div class="notifications-head__text">
          <h2>Notifications</h2>
          <p>Upload request updates and administrator decisions appear here.</p>
        </div>
        <span v-if="notifications.unreadCount" class="notification-badge">{{ notifications.unreadCount }} unread</span>
      </div>

      <div v-if="notifications.loading" class="loading-state"><p>Loading notifications...</p></div>
      <p v-else-if="notifications.error" class="form-error">{{ notifications.error }}</p>
      <div v-else-if="notifications.items.length" class="notification-list">
        <article v-for="notification in notifications.items" :key="notification.id" class="notification-card" :class="{ 'notification-card--unread': !notification.isRead }">
          <div>
            <h3>{{ notification.title }}</h3>
            <p>{{ notification.message }}</p>
            <small>{{ formatDate(notification.createdAt) }}</small>
          </div>
          <button class="button button--ghost button--small" type="button" :disabled="notification.isRead" @click="notifications.markRead(notification.id)">
            {{ notification.isRead ? 'Read' : 'Mark read' }}
          </button>
        </article>
      </div>
      <div v-else class="empty-state">
        <h3>No notifications</h3>
        <p>Updates will appear here when your upload request changes status.</p>
      </div>
    </div>
  </section>
</template>
