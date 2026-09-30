<script setup>
import { computed, ref } from 'vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
const props = defineProps({ requests: { type: Array, default: () => [] }, revisions: { type: Array, default: () => [] }, isOwner: Boolean })
const status = ref(''); const filtered = computed(() => props.requests.filter(request => !status.value || request.status === status.value))
</script>

<template>
  <section>
    <div class="section-heading"><h2>{{ revisions.length ? 'My Contributions' : 'Upload Requests' }}</h2><RouterLink v-if="isOwner && !revisions.length" class="button button--primary" to="/dashboard/upload">แบ่งปันเอกสาร</RouterLink></div>
    <div v-if="!isOwner" class="empty-state"><h3>ข้อมูลส่วนนี้เป็นข้อมูลส่วนตัว</h3></div>
    <template v-else-if="revisions.length"><article v-for="revision in revisions" :key="revision.id" class="document-profile__row"><div class="document-profile__row-heading"><h3>{{ revision.documentTitle }}</h3><StatusBadge :value="revision.status" /></div><p>{{ revision.changeSummary }}</p><p class="material-meta">{{ revision.revisionType }} · {{ revision.versionNumber ? `เผยแพร่เป็น v${revision.versionNumber}` : 'ยังไม่กำหนดหมายเลขเวอร์ชัน' }} · {{ new Date(revision.createdAt).toLocaleDateString('th-TH') }}</p><p v-if="revision.reviewNote" class="form-error">เหตุผล: {{ revision.reviewNote }}</p></article></template>
    <template v-else><label>Status<select v-model="status"><option value="">All</option><option v-for="value in [...new Set(requests.map(request => request.status))]" :key="value">{{ value }}</option></select></label><div v-if="!filtered.length" class="empty-state"><h3>{{ requests.length ? 'No matching requests.' : 'You don’t have any upload requests yet.' }}</h3></div><RouterLink v-for="request in filtered" :key="request.id" class="document-profile__row document-profile__request" :to="{ path: '/dashboard/upload', query: { request: request.id } }"><div class="document-profile__row-heading"><h3>{{ request.title }}</h3><StatusBadge :value="request.status" /></div><p>{{ request.fileName }}</p><p class="material-meta">{{ request.documentType }} · {{ request.courseName }} · {{ new Date(request.createdAt).toLocaleDateString('th-TH') }}</p><p v-if="request.rejectionReason" class="material-meta">{{ request.rejectionReason }}</p></RouterLink></template>
  </section>
</template>
