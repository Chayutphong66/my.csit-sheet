<script setup>
import DashboardShell from '@/components/layout/DashboardShell.vue'

const navItems = [
  { label: 'ภาพรวม', to: '/admin/dashboard' },
  { label: 'คิวตรวจสอบ', to: '/admin/request' },
  { label: 'เผยแพร่เอกสาร', to: '/admin/upload' },
  { label: 'ผู้ใช้งาน', to: '/admin/status' },
  { label: 'รายวิชา', to: '/admin/subject' }
]
</script>

<template>
  <DashboardShell role-label="ผู้ดูแลระบบ" :nav-items="navItems">
    <RouterView />
  </DashboardShell>
</template>
