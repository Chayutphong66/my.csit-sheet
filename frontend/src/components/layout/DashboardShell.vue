<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'

defineProps({ roleLabel: { type: String, required: true }, navItems: { type: Array, required: true } })
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const notifications = useNotificationStore()
const menuOpen = ref(false)
const isUser = computed(() => auth.user?.role === 'USER')
const displayName = computed(() => auth.user?.displayName || auth.user?.username || 'CSIT')
const initials = computed(() => displayName.value.slice(0, 2).toUpperCase())
async function logout() { await auth.logout(); router.push('/') }
watch(() => route.fullPath, () => { menuOpen.value = false })
onMounted(() => { if (isUser.value) notifications.load() })
</script>

<template>
  <div class="dashboard-shell">
    <header class="dashboard-topbar">
      <RouterLink :to="isUser ? '/dashboard/home' : '/admin/dashboard'" class="brand" aria-label="CSIT Sheet หน้าหลัก">
        <span class="brand__mark">CS</span><span><strong>CSIT Sheet</strong><small>Knowledge sharing</small></span>
      </RouterLink>
      <nav class="dashboard-nav" :aria-label="`${roleLabel} navigation`">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="dashboard-nav__link">{{ item.label }}</RouterLink>
      </nav>
      <div class="dashboard-account">
        <RouterLink v-if="isUser" to="/dashboard/search" class="icon-button search-shortcut" aria-label="ค้นหา"><span aria-hidden="true">⌕</span></RouterLink>
        <RouterLink v-if="isUser" to="/dashboard/profile" class="notif-bell icon-button" :aria-label="`การแจ้งเตือน${notifications.unreadCount ? ` ${notifications.unreadCount} รายการที่ยังไม่อ่าน` : ''}`">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
          <span v-if="notifications.unreadCount" class="notif-bell__badge">{{ notifications.unreadCount > 9 ? '9+' : notifications.unreadCount }}</span>
        </RouterLink>
        <span class="account-chip"><span class="account-avatar" aria-hidden="true">{{ initials }}</span><span class="account-chip__name">{{ displayName }}</span></span>
        <button class="button button--ghost desktop-logout" type="button" @click="logout">ออกจากระบบ</button>
        <button class="menu-button" type="button" :aria-expanded="menuOpen" aria-controls="mobile-dashboard-menu" aria-label="เปิดเมนู" @click="menuOpen = !menuOpen"><span></span><span></span><span></span></button>
      </div>
      <Transition name="menu">
        <div v-if="menuOpen" id="mobile-dashboard-menu" class="mobile-dashboard-menu">
          <nav :aria-label="`${roleLabel} mobile navigation`"><RouterLink v-for="item in navItems" :key="item.to" :to="item.to">{{ item.label }}</RouterLink><RouterLink v-if="isUser" to="/dashboard/search">ค้นหา</RouterLink></nav>
          <button class="button button--ghost" type="button" @click="logout">ออกจากระบบ</button>
        </div>
      </Transition>
    </header>
    <main class="dashboard-main"><slot /></main>
  </div>
</template>
