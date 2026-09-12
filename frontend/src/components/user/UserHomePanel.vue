<script setup>
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { documentApi } from '@/services/document.service'

const auth = useAuthStore()
const courses = ref([])
const loading = ref(true)
const error = ref('')
onMounted(async () => {
  try { courses.value = await documentApi.courses() } catch (_error) { error.value = 'Unable to load courses.' } finally { loading.value = false }
})
</script>
<template><div class="home"><section class="page-panel home-hero-panel"><div class="panel__header"><div><p class="eyebrow">Welcome back</p><h1>Browse course documents.</h1><p class="page-copy">Choose a course, then an academic year and semester.</p></div><span class="count-pill">{{ auth.user?.username }}</span></div><RouterLink class="button button--primary" to="/dashboard/search">Search documents</RouterLink></section><p v-if="error" class="form-error">{{ error }}</p><div v-if="loading" class="loading-state">Loading courses...</div><section v-else class="page-panel"><div class="panel__header"><div><p class="eyebrow">Courses</p><h2 class="section-title">Course library</h2></div><span class="count-pill">{{ courses.length }} courses</span></div><div v-if="courses.length" class="catalog-grid"><article v-for="course in courses" :key="course.id" class="material-card"><div class="material-card__top"><span class="material-type">{{ course.code }}</span><span class="material-meta">{{ course.documentCount }} documents</span></div><h2>{{ course.name }}</h2><p>{{ course.description || 'Course learning materials' }}</p><RouterLink class="button button--primary" :to="`/dashboard/courses/${course.id}`">View</RouterLink></article></div><div v-else class="empty-state"><h2>No courses available</h2></div></section></div></template>
