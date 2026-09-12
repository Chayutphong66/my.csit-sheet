<script setup>
import { computed, onMounted, ref } from 'vue'
import { sheetApi } from '@/services/sheet.service'

const sheets = ref([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const courseFilter = ref('')
const yearFilter = ref('')
const downloadingId = ref('')

onMounted(async () => {
  try {
    sheets.value = (await sheetApi.all()) ?? []
  } catch (_err) {
    error.value = 'Unable to load summary sheets.'
  } finally {
    loading.value = false
  }
})

const filteredSheets = computed(() => {
  const term = search.value.trim().toLowerCase()
  return sheets.value.filter((sheet) => {
    const matchesKeyword = !term || [sheet.title, sheet.subject, sheet.uploaderUsername]
      .some((value) => String(value ?? '').toLowerCase().includes(term))
    return matchesKeyword &&
      (!courseFilter.value || sheet.subject === courseFilter.value) &&
      (!yearFilter.value || sheet.academicYear === yearFilter.value)
  })
})

const courses = computed(() => [...new Set(sheets.value.map((item) => item.subject).filter(Boolean))].sort())
const years = computed(() => [...new Set(sheets.value.map((item) => item.academicYear).filter(Boolean))].sort().reverse())
const hasFilters = computed(() => Boolean(search.value || courseFilter.value || yearFilter.value))

function clearFilters() {
  search.value = ''
  courseFilter.value = ''
  yearFilter.value = ''
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function downloadSheet(sheet) {
  error.value = ''
  downloadingId.value = sheet.id
  try {
    const { blob, fileName } = await sheetApi.downloadFile(sheet.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName || sheet.fileName || sheet.title || 'download'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (_err) {
    error.value = 'Unable to download this summary sheet.'
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
        <h1>Summary Sheets</h1>
        <p>Revision notes, summaries, and exam-preparation sheets shared by the CSIT community.</p>
      </div>
      <span v-if="!loading && !error" class="sheet-count">{{ filteredSheets.length }} of {{ sheets.length }}</span>
    </div>

    <div v-if="error" class="form-error">{{ error }}</div>

    <div class="filter-bar sheet-filter-bar">
      <label class="search-field">
        <span class="sr-only">Search sheets</span>
        <input v-model="search" type="search" placeholder="Search sheets" />
      </label>
      <select v-model="courseFilter" aria-label="Filter sheets by course">
        <option value="">All courses</option>
        <option v-for="course in courses" :key="course" :value="course">{{ course }}</option>
      </select>
      <select v-model="yearFilter" aria-label="Filter sheets by academic year">
        <option value="">All years</option>
        <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
      </select>
      <button class="button button--ghost button--small" type="button" :disabled="!hasFilters" @click="clearFilters">Clear</button>
    </div>

    <div v-if="loading" class="loading-state skeleton-list">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>

    <template v-else>
      <div v-if="filteredSheets.length" class="sheet-grid">
        <article v-for="sheet in filteredSheets" :key="sheet.id" class="sheet-card">
          <div class="sheet-card__top">
            <span class="sheet-card__subject">Sheet</span>
            <span class="sheet-card__downloads">{{ sheet.downloadCount ?? 0 }} downloads</span>
          </div>
          <h2 class="sheet-card__title">{{ sheet.title }}</h2>
          <p class="material-meta">{{ sheet.subject || 'No course' }}<span v-if="sheet.academicYear"> - {{ sheet.academicYear }}</span></p>
          <div class="sheet-card__footer">
            <span class="sheet-card__uploader">{{ sheet.uploaderUsername || 'Unknown' }}</span>
            <span class="sheet-card__date">{{ formatDate(sheet.createdAt) }}</span>
          </div>
          <button v-if="sheet.hasFile" class="button button--primary button--small sheet-card__download" type="button" :disabled="downloadingId === sheet.id" @click="downloadSheet(sheet)">
            {{ downloadingId === sheet.id ? 'Downloading...' : 'Download' }}
          </button>
        </article>
      </div>

      <div v-else class="empty-state">
        <h2>{{ sheets.length ? 'No matching sheets' : 'No summary sheets yet' }}</h2>
        <p>{{ sheets.length ? 'Try clearing filters or searching another course.' : 'Approved summary sheets will appear here.' }}</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.sheet-filter-bar { grid-template-columns: minmax(220px, 1fr) repeat(2, minmax(140px, 190px)) auto; }
@media (max-width: 980px) { .sheet-filter-bar { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 720px) { .sheet-filter-bar { grid-template-columns: 1fr; } }
</style>
