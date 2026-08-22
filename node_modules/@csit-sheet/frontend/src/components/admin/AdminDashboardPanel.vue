<script setup>
import { onMounted, ref } from 'vue'
import { sheetApi } from '@/services/api'

const stats = ref(null)

onMounted(async () => {
  stats.value = await sheetApi.stats()
})
</script>

<template>
  <section class="page-panel">
    <p class="eyebrow">Admin</p>
    <h1>Dashboard</h1>
    <p>ภาพรวมข้อมูลระบบสำหรับผู้ดูแล</p>

    <div v-if="stats" class="stats-grid">
      <article class="stat-card">
        <span>Users</span>
        <strong>{{ stats.totalUsers }}</strong>
      </article>
      <article class="stat-card">
        <span>Sheets</span>
        <strong>{{ stats.totalSheets }}</strong>
      </article>
      <article class="stat-card">
        <span>Pending</span>
        <strong>{{ stats.pendingCount }}</strong>
      </article>
      <article class="stat-card">
        <span>Approved</span>
        <strong>{{ stats.approvedCount }}</strong>
      </article>
    </div>
  </section>
</template>
