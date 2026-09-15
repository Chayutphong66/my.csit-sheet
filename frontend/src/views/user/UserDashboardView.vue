<script setup>
import DashboardShell from '@/components/layout/DashboardShell.vue'

const navItems = [
  { label: 'หน้าหลัก', to: '/dashboard/home' },
  { label: 'เอกสารการสอน', to: '/dashboard/lec' },
  { label: 'ชีทสรุป', to: '/dashboard/sheet' },
  { label: 'อัปโหลด', to: '/dashboard/upload' },
  { label: 'โปรไฟล์', to: '/dashboard/profile' }
]
</script>

<template>
  <DashboardShell role-label="ผู้ใช้งาน" :nav-items="navItems">
    <RouterView />
  </DashboardShell>
</template>
