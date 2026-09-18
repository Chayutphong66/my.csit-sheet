<script setup>
import { computed, ref } from 'vue'
import DocumentImpactActions from '@/components/user/DocumentImpactActions.vue'
const props = defineProps({ documents: { type: Array, default: () => [] }, starred: Boolean, busy: String })
defineEmits(['star', 'view', 'download', 'helpful'])
const search = ref(''); const type = ref(''); const course = ref(''); const sort = ref(props.starred ? 'starred' : 'updated')
const subjects = computed(() => [...new Map(props.documents.map(d => [d.courseId, { id: d.courseId, name: `${d.courseCode} ${d.courseName}` }])).values()])
const filtered = computed(() => props.documents.filter(d => (!type.value || d.documentType === type.value) && (!course.value || d.courseId === course.value) && `${d.title} ${d.description || ''} ${d.courseCode} ${d.courseName}`.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())).toSorted((a, b) => {
  if (sort.value === 'popular') return (b.starCount || 0) - (a.starCount || 0) || b.downloadCount - a.downloadCount
  if (sort.value === 'downloads') return b.downloadCount - a.downloadCount
  const key = sort.value === 'starred' ? 'starredAt' : sort.value === 'uploaded' ? 'createdAt' : 'updatedAt'
  return String(b[key] || b.createdAt).localeCompare(String(a[key] || a.createdAt))
}))
</script>
<template>
  <section><h2>{{ starred ? 'Stars' : 'Documents' }}</h2>
    <div class="document-profile__filters">
      <label class="document-profile__search">{{ starred ? 'Search starred documents' : 'Search documents' }}<input v-model="search" type="search" :placeholder="starred ? 'Search starred documents…' : 'Find a document…'" /></label>
      <label>Type<select v-model="type"><option value="">All</option><option>Sheet</option><option>Lecture</option></select></label>
      <label>Subject<select v-model="course"><option value="">All subjects</option><option v-for="subject in subjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option></select></label>
      <label>Sort<select v-model="sort"><option v-if="starred" value="starred">Recently starred</option><option value="updated">Recently updated</option><option value="uploaded">Recently uploaded</option><option value="popular">Most starred</option><option value="downloads">Most downloaded</option></select></label>
    </div>
    <div v-if="!filtered.length" class="empty-state"><h3>{{ documents.length ? 'No matching documents.' : starred ? 'No starred documents yet.' : 'No public documents yet.' }}</h3><p>เอกสารที่เผยแพร่แล้วจะปรากฏที่นี่</p></div>
    <article v-for="document in filtered" :key="`${document.documentType}:${document.id}`" class="document-profile__row">
      <div class="document-profile__row-heading"><button class="document-profile__title" :disabled="Boolean(busy)" @click="$emit('view', document)">{{ document.title }}</button><span class="type-chip">Public</span></div>
      <p>{{ document.courseCode }} · {{ document.courseName }}</p><p v-if="document.description" class="material-meta">{{ document.description }}</p>
      <div class="document-profile__metadata"><span class="type-chip">{{ document.documentType }}</span><span>☆ {{ document.starCount || 0 }}</span><span>Updated {{ new Date(document.updatedAt || document.createdAt).toLocaleDateString('th-TH') }}</span><button class="button button--ghost button--small" :aria-pressed="Boolean(document.starredByMe)" :disabled="Boolean(busy)" @click="$emit('star', document)">{{ document.starredByMe ? '★ Starred' : '☆ Star' }}</button></div>
      <DocumentImpactActions :document="document" :busy="Boolean(busy)" @view="$emit('view', document)" @download="$emit('download', document)" @helpful="$emit('helpful', document)" />
    </article>
  </section>
</template>
