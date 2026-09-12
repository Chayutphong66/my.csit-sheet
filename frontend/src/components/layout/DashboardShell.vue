<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'

defineProps({
  roleLabel: { type: String, required: true },
  navItems: { type: Array, required: true }
})

const auth = useAuthStore()
const router = useRouter()
const notifications = useNotificationStore()

const isUser = computed(() => auth.user?.role === 'USER')
const initials = computed(() => String(auth.user?.username || 'CS').slice(0, 2).toUpperCase())

async function logout() {
  await auth.logout()
  router.push('/')
}

onMounted(() => {
  if (isUser.value) notifications.load()
})
</script>

<template>
  <div class="dashboard-shell">
    <header class="dashboard-topbar">
      <RouterLink to="/" class="brand">
        <span class="brand__mark">CS</span>
        <span>CSIT Sheet</span>
      </RouterLink>

      <nav class="dashboard-nav" :aria-label="`${roleLabel} navigation`">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="dashboard-nav__link">
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="dashboard-account">
        <RouterLink
          v-if="isUser"
          to="/dashboard/profile"
          class="notif-bell"
          :aria-label="`Notifications${notifications.unreadCount ? `, ${notifications.unreadCount} unread` : ''}`"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>
          <span v-if="notifications.unreadCount" class="notif-bell__badge">
            {{ notifications.unreadCount > 9 ? '9+' : notifications.unreadCount }}
          </span>
        </RouterLink>
        <span class="account-chip">
          <span class="account-avatar" aria-hidden="true">{{ initials }}</span>
          <span>{{ auth.user?.username }}</span>
        </span>
        <button class="button button--ghost" type="button" @click="logout">Log out</button>
      </div>
    </header>

    <main class="dashboard-main">
      <slot />
    </main>
  </div>
</template>
