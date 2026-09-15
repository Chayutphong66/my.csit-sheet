<script setup>
import { computed } from 'vue'
const props = defineProps({ username: { type: String, default: '' }, displayName: { type: String, default: '' }, avatarUrl: { type: String, default: '' }, linked: { type: Boolean, default: true }, compact: { type: Boolean, default: false } })
const name = computed(() => props.displayName || props.username || 'ชุมชน CSIT')
const initials = computed(() => name.value.trim().slice(0, 2).toUpperCase())
const route = computed(() => props.username ? `/dashboard/users/${encodeURIComponent(props.username)}` : '')
</script>
<template>
  <component :is="linked && route ? 'RouterLink' : 'div'" :to="linked && route ? route : undefined" class="user-identity" :class="{ 'user-identity--compact': compact }">
    <img v-if="avatarUrl" class="user-identity__avatar" :src="avatarUrl" :alt="`รูปโปรไฟล์ของ ${name}`" />
    <span v-else class="user-identity__avatar user-identity__avatar--fallback" aria-hidden="true">{{ initials }}</span>
    <span class="user-identity__text"><strong>{{ name }}</strong><small v-if="username">@{{ username }}</small></span>
  </component>
</template>
