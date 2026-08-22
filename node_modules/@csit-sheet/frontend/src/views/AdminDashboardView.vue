<script setup>
import DashboardShell from '@/components/layout/DashboardShell.vue'

const navItems = [
  { label: 'Request', to: '/admin/request' },
  { label: 'Upload', to: '/admin/upload' },
  { label: 'Status', to: '/admin/status' },
  { label: 'Subject', to: '/admin/subject' },
  { label: 'Dashboard', to: '/admin/dashboard' }
]
</script>

<template>
  <DashboardShell role-label="Admin" :nav-items="navItems">
    <RouterView />
  </DashboardShell>
</template>
