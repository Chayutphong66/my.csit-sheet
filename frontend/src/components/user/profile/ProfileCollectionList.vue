<script setup>
defineProps({ collections: { type: Array, default: () => [] }, isOwner: Boolean })
</script>
<template>
  <section class="content-section">
    <div class="section-heading"><h2>Collections</h2><RouterLink v-if="isOwner" class="button button--primary button--small" to="/dashboard/collections">จัดการ Collections</RouterLink></div>
    <div v-if="collections.length" class="collection-grid"><article v-for="item in collections" :key="item.id" class="collection-card"><span class="type-chip">{{ item.collectionType }}</span><h3>{{ item.name }}</h3><p>{{ item.description }}</p><p class="material-meta">{{ item.documentCount }} เอกสาร · {{ item.publicationStatus }}</p><RouterLink v-if="item.publicationStatus === 'PUBLISHED'" class="text-link" :to="`/dashboard/c/${item.slug}`">เปิด Collection →</RouterLink><RouterLink v-else-if="isOwner" class="text-link" :to="`/dashboard/collections/${item.id}/edit`">จัดการ →</RouterLink></article></div>
    <div v-else class="empty-state"><h3>ยังไม่มี Collection</h3></div>
  </section>
</template>
