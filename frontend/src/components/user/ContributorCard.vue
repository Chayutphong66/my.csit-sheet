<script setup>
import UserIdentity from '@/components/shared/UserIdentity.vue'
defineProps({ contributor: { type: Object, required: true } })
</script>
<template>
  <article class="contributor-card">
    <UserIdentity :username="contributor.username" :display-name="contributor.displayName" :avatar-url="contributor.avatarUrl" />
    <p class="material-meta">{{ contributor.contributorLevel }} · {{ contributor.publishedCount }} ผลงานเผยแพร่ · {{ contributor.helpful }} มีประโยชน์</p>
    <RouterLink class="text-link" :to="`/dashboard/users/${encodeURIComponent(contributor.username)}`">ดูโปรไฟล์และผลงาน →</RouterLink>
  </article>
</template>
