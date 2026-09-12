<script setup>
import { computed, onMounted, ref } from 'vue'
import { adminApi } from '@/services/admin.service'

const stats = ref(null)
const error = ref('')
const loading = ref(true)

onMounted(async () => {
  try {
    stats.value = await adminApi.stats()
  } catch (_err) {
    error.value = 'Unable to load admin dashboard.'
  } finally {
    loading.value = false
  }
})

const statCards = computed(() => stats.value ? [
  { label: 'Users', value: stats.value.totalUsers, hint: 'Registered accounts' },
  { label: 'Sheets', value: stats.value.totalSheets, hint: 'Sheet catalog records' },
  { label: 'Pending sheets', value: stats.value.pendingCount, hint: 'Awaiting review' },
  { label: 'Approved sheets', value: stats.value.approvedCount, hint: 'Visible to users' },
  { label: 'Pending requests', value: stats.value.pendingRequests, hint: 'Upload queue' },
  { label: 'Rejected requests', value: stats.value.rejectedRequests, hint: 'Declined uploads' }
] : [])
</script>

<template>
  <section class="page-panel">
    <div class="panel__header">
      <div>
        <p class="eyebrow">Admin overview</p>
        <h1>Dashboard</h1>
        <p>Monitor platform activity, moderation load, and publication status.</p>
      </div>
    </div>

    <div v-if="loading" class="loading-state skeleton-list"><div class="skeleton-line"></div><div class="skeleton-line"></div></div>
    <p v-else-if="error" class="form-error">{{ error }}</p>
    <div v-else class="stats-grid">
      <article v-for="card in statCards" :key="card.label" class="stat-card">
        <span>{{ card.label }}</span>
        <strong>{{ card.value ?? 0 }}</strong>
        <p class="material-meta">{{ card.hint }}</p>
      </article>
    </div>
  </section>
</template>
