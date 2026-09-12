<script setup>
import DashboardShell from '@/components/layout/DashboardShell.vue'

const navItems = [
  { label: 'Home', to: '/dashboard/home' },
  { label: 'Lectures', to: '/dashboard/lec' },
  { label: 'Sheets', to: '/dashboard/sheet' },
  { label: 'Upload', to: '/dashboard/upload' },
  { label: 'Profile', to: '/dashboard/profile' }
]
</script>

<template>
  <DashboardShell role-label="User" :nav-items="navItems">
    <RouterView />
  </DashboardShell>
</template>
