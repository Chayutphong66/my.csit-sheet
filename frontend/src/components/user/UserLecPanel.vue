<script setup>
import { computed, onMounted, ref } from 'vue'
import { lectureApi } from '@/services/sheet.service'

const lectures = ref([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const courseFilter = ref('')
const yearFilter = ref('')
const instructorFilter = ref('')
const downloadingId = ref('')

onMounted(async () => {
  try {
    lectures.value = (await lectureApi.all()) ?? []
  } catch (_err) {
    error.value = 'Unable to load lecture files.'
  } finally {
    loading.value = false
  }
})

const filteredLectures = computed(() => {
  const term = search.value.trim().toLowerCase()
  return lectures.value.filter((lecture) => {
    const matchesKeyword = !term || [lecture.title, lecture.subject, lecture.instructor]
      .some((value) => String(value ?? '').toLowerCase().includes(term))
    return matchesKeyword &&
      (!courseFilter.value || lecture.subject === courseFilter.value) &&
      (!yearFilter.value || lecture.academicYear === yearFilter.value) &&
      (!instructorFilter.value || lecture.instructor === instructorFilter.value)
  })
})

const courses = computed(() => [...new Set(lectures.value.map((item) => item.subject).filter(Boolean))].sort())
const years = computed(() => [...new Set(lectures.value.map((item) => item.academicYear).filter(Boolean))].sort().reverse())
const instructors = computed(() => [...new Set(lectures.value.map((item) => item.instructor).filter(Boolean))].sort())
const hasFilters = computed(() => Boolean(search.value || courseFilter.value || yearFilter.value || instructorFilter.value))

function clearFilters() {
  search.value = ''
  courseFilter.value = ''
  yearFilter.value = ''
  instructorFilter.value = ''
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function downloadLecture(lecture) {
  error.value = ''
  downloadingId.value = lecture.id
  try {
    const { blob, fileName } = await lectureApi.downloadFile(lecture.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName || lecture.fileName || lecture.title || 'download'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (_err) {
    error.value = 'Unable to download this lecture file.'
  } finally {
    downloadingId.value = ''
  }
}
</script>

<template>
  <section class="page-panel">
    <div class="panel__header">
      <div>
        <p class="eyebrow">Learning Resources</p>
        <h1>Lecture Files</h1>
        <p>Course files, slides, and classroom documents organized by course, instructor, and year.</p>
      </div>
      <span v-if="!loading && !error" class="lecture-count">{{ filteredLectures.length }} of {{ lectures.length }}</span>
    </div>

    <div v-if="error" class="form-error">{{ error }}</div>

    <div class="filter-bar">
      <label class="search-field">
        <span class="sr-only">Search lectures</span>
        <input v-model="search" type="search" placeholder="Search lectures" />
      </label>
      <select v-model="courseFilter" aria-label="Filter lectures by course">
        <option value="">All courses</option>
        <option v-for="course in courses" :key="course" :value="course">{{ course }}</option>
      </select>
      <select v-model="yearFilter" aria-label="Filter lectures by academic year">
        <option value="">All years</option>
        <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
      </select>
      <select v-model="instructorFilter" aria-label="Filter lectures by instructor">
        <option value="">All instructors</option>
        <option v-for="instructor in instructors" :key="instructor" :value="instructor">{{ instructor }}</option>
      </select>
      <button class="button button--ghost button--small" type="button" :disabled="!hasFilters" @click="clearFilters">Clear</button>
    </div>

    <div v-if="loading" class="loading-state skeleton-list">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>

    <template v-else>
      <div v-if="filteredLectures.length" class="lecture-grid">
        <article v-for="lecture in filteredLectures" :key="lecture.id" class="lecture-card">
          <div class="lecture-card__top">
            <span class="lecture-card__subject">Lecture</span>
            <span v-if="lecture.academicYear" class="lecture-card__year">{{ lecture.academicYear }}</span>
          </div>
          <h2 class="lecture-card__title">{{ lecture.title }}</h2>
          <p class="lecture-card__desc">{{ lecture.subject }}<span v-if="lecture.instructor"> - {{ lecture.instructor }}</span></p>
          <div class="lecture-card__footer">
            <span class="lecture-card__instructor">{{ lecture.uploaderUsername || 'CSIT' }}</span>
            <span class="lecture-card__date">{{ lecture.downloadCount ?? 0 }} downloads - {{ formatDate(lecture.createdAt) }}</span>
          </div>
          <button v-if="lecture.hasFile" class="button button--primary button--small lecture-card__download" type="button" :disabled="downloadingId === lecture.id" @click="downloadLecture(lecture)">
            {{ downloadingId === lecture.id ? 'Downloading...' : 'Download' }}
          </button>
        </article>
      </div>

      <div v-else class="empty-state">
        <h2>{{ lectures.length ? 'No matching lectures' : 'No lecture files yet' }}</h2>
        <p>{{ lectures.length ? 'Try clearing filters or searching another course.' : 'Approved lecture files will appear here.' }}</p>
      </div>
    </template>
  </section>
</template>
