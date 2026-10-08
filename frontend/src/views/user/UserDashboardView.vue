<script setup>
import DashboardShell from '@/components/layout/DashboardShell.vue'

const navItems = [
  { label: 'หน้าหลัก', to: '/dashboard/home' },
  { label: 'กำลังติดตาม', to: '/dashboard/following' },
  { label: 'เอกสารการสอน', to: '/dashboard/lec' },
  { label: 'ชีทสรุป', to: '/dashboard/sheet' },
  { label: 'อัปโหลด', to: '/dashboard/upload' },
  { label: 'โปรไฟล์', to: '/dashboard/profile' }
]
</script>

<template>
  <DashboardShell role-label="ผู้ใช้งาน" :nav-items="navItems">
    <RouterView :key="['user-profile', 'public-profile'].includes($route.name) ? $route.path : $route.fullPath" />
  </DashboardShell>
</template>
