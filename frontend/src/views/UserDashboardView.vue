<script setup>
import DashboardShell from '@/components/layout/DashboardShell.vue'

const navItems = [
  { label: 'HOME', to: '/dashboard/home' },
  { label: 'SHEET', to: '/dashboard/sheet' },
  { label: 'LEC', to: '/dashboard/lec' },
  { label: 'UPLOAD', to: '/dashboard/upload' },
  { label: 'Profile', to: '/dashboard/profile' }
]
</script>

<template>
  <DashboardShell role-label="User" :nav-items="navItems">
    <RouterView />
  </DashboardShell>
</template>
