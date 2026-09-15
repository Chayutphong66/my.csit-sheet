<script setup>
import { computed } from 'vue'
import { duplicateLabel, statusLabel } from '@/services/terminology'
const props = defineProps({ value: { type: String, required: true }, duplicate: { type: Boolean, default: false } })
const label = computed(() => props.duplicate ? duplicateLabel(props.value) : statusLabel(props.value))
const tone = computed(() => ['COMPLETED', 'APPROVED', 'NONE'].includes(props.value) ? 'success' : ['REJECTED', 'FAILED', 'EXACT_DUPLICATE', 'CONTENT_DUPLICATE'].includes(props.value) ? 'danger' : ['PENDING', 'PROCESSING', 'POSSIBLE_DUPLICATE'].includes(props.value) ? 'warning' : 'info')
</script>
<template><span class="status-badge" :class="`status-badge--${tone}`"><span aria-hidden="true">●</span>{{ label }}</span></template>
