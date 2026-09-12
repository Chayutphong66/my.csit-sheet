<script setup>
import DashboardShell from '@/components/layout/DashboardShell.vue'

const navItems = [
  { label: 'HOME', to: '/dashboard/home' },
  { label: 'Lectures', to: '/dashboard/lec' },
  { label: 'Sheets', to: '/dashboard/sheet' },
  { label: 'UPLOAD', to: '/dashboard/upload' },
  { label: 'My Upload Requests', to: '/dashboard/requests' },
  { label: 'Profile', to: '/dashboard/profile' }
]
</script>

<template>
  <DashboardShell role-label="User" :nav-items="navItems">
    <RouterView />
  </DashboardShell>
</template>
