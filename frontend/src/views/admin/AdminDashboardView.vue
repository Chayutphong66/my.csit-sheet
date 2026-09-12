<script setup>
import DashboardShell from '@/components/layout/DashboardShell.vue'

const navItems = [
  { label: 'Requests', to: '/admin/request' },
  { label: 'Publish', to: '/admin/upload' },
  { label: 'Status', to: '/admin/status' },
  { label: 'Subjects', to: '/admin/subject' },
  { label: 'Dashboard', to: '/admin/dashboard' }
]
</script>

<template>
  <DashboardShell role-label="Admin" :nav-items="navItems">
    <RouterView />
  </DashboardShell>
</template>
