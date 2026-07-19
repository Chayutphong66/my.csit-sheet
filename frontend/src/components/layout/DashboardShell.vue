<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

defineProps({
  roleLabel: { type: String, required: true },
  navItems: { type: Array, required: true }
})

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  router.push('/')
}
</script>

<template>
  <div class="dashboard-shell">
    <header class="dashboard-topbar">
      <RouterLink to="/" class="brand">
        <span class="brand__mark">CS</span>
        <span>CSIT Sheet</span>
      </RouterLink>

      <nav class="dashboard-nav" :aria-label="`${roleLabel} navigation`">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="dashboard-nav__link"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="dashboard-account">
        <span>{{ auth.user?.username }}</span>
        <button class="button button--ghost" @click="logout">ออกจากระบบ</button>
      </div>
    </header>

    <main class="dashboard-main">
      <slot />
    </main>
  </div>
</template>
