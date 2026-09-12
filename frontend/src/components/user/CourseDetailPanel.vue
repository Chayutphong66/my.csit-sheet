<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { documentApi } from '@/services/document.service'
const props = defineProps({ documentType: { type: String, default: '' }, basePath: { type: String, default: '/dashboard/courses' } })
const route = useRoute(); const data = ref(null); const error = ref('')
onMounted(async () => { try { data.value = await documentApi.courseYears(route.params.courseId, props.documentType) } catch (_error) { error.value = 'Unable to load this course.' } })
</script>
<template><section class="page-panel"><p v-if="error" class="form-error">{{ error }}</p><div v-else-if="!data" class="loading-state">Loading academic years...</div><template v-else><p class="eyebrow">{{ data.course.code }}<span v-if="documentType"> · {{ documentType }}s</span></p><h1>{{ data.course.name }}</h1><p>{{ data.course.description }}</p><div v-if="data.years.length" class="catalog-grid"><article v-for="year in data.years" :key="year.academicYear" class="material-card"><h2>Academic Year {{ year.academicYear }}</h2><p>{{ year.documentCount }} {{ documentType ? `${documentType} files` : 'documents' }}</p><RouterLink class="button button--primary" :to="`${basePath}/${data.course.id}/years/${year.academicYear}`">More</RouterLink></article></div><div v-else class="empty-state"><h2>No published {{ documentType ? documentType.toLowerCase() : 'document' }} files yet</h2></div></template></section></template>
