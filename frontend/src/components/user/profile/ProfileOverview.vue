<script setup>
import { computed } from 'vue'
import ContributionGraph from './ContributionGraph.vue'
import ProfileNotifications from './ProfileNotifications.vue'
const props = defineProps({ profile: { type: Object, required: true }, busy: String })
defineEmits(['view', 'star'])
const popular = computed(() => [...props.profile.documents].sort((a, b) => (b.starCount || 0) - (a.starCount || 0) || b.downloadCount - a.downloadCount || String(b.createdAt).localeCompare(a.createdAt)).slice(0, 6))
</script>
<template>
  <section><div class="section-heading"><h2>Popular documents</h2><span class="material-meta">เอกสารสาธารณะ</span></div>
    <div v-if="!popular.length" class="empty-state"><h3>No public documents yet.</h3><RouterLink v-if="profile.isOwner" class="button button--primary" to="/dashboard/upload">แบ่งปันเอกสาร</RouterLink></div>
    <div v-else class="document-profile__popular"><article v-for="document in popular" :key="`${document.documentType}:${document.id}`" class="document-profile__popular-card"><div class="document-profile__row-heading"><button class="document-profile__title" :disabled="Boolean(busy)" @click="$emit('view', document)">{{ document.title }}</button><span class="type-chip">Public</span></div><p>{{ document.courseCode }} · {{ document.courseName }}</p><p v-if="document.description" class="material-meta">{{ document.description }}</p><div class="document-profile__metadata"><span class="type-chip">{{ document.documentType }}</span><button class="button button--ghost button--small" :disabled="Boolean(busy)" :aria-pressed="Boolean(document.starredByMe)" @click="$emit('star', document)">{{ document.starredByMe ? '★' : '☆' }} {{ document.starCount || 0 }}</button><span>{{ document.downloadCount || 0 }} ดาวน์โหลด</span></div></article></div>
    <ContributionGraph :activity="profile.activity" />
    <section class="content-section"><h2>Activity overview</h2><p v-if="!profile.activity.length" class="empty-state">ยังไม่มีกิจกรรมการแบ่งปัน</p><ol v-else class="document-profile__activity"><li v-for="(event, index) in profile.activity.slice(0, 20)" :key="index"><span class="type-chip">{{ event.kind }}</span><strong>{{ event.title }}</strong><time :datetime="event.date">{{ new Date(event.date).toLocaleDateString('th-TH') }}</time></li></ol></section>
    <ProfileNotifications v-if="profile.isOwner" />
  </section>
</template>
