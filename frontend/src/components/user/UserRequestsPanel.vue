<script setup>
import { computed, onMounted, ref } from 'vue'
import UploadStatusTimeline from '@/components/sheet/UploadStatusTimeline.vue'
import { uploadApi } from '@/services/upload.service'

const requests = ref([])
const loading = ref(true)
const error = ref('')
const props = defineProps({ embedded: { type: Boolean, default: false }, selectedId: { type: String, default: '' } })
const openId = ref(props.selectedId)
const downloadingId = ref('')
const activeStatus = ref('ALL')

const statuses = ['ALL', 'PENDING', 'COMPLETED', 'REJECTED']
const selectedRequest = computed(() => requests.value.find((request) => request.id === openId.value))
const filteredRequests = computed(() => activeStatus.value === 'ALL'
  ? requests.value
  : requests.value.filter((request) => activeStatus.value === 'REJECTED'
    ? ['REJECTED', 'FAILED'].includes(String(request.status).toUpperCase())
    : String(request.status).toUpperCase() === activeStatus.value))

onMounted(async () => {
  try {
    requests.value = (await uploadApi.uploadRequests()) ?? []
  } catch (_err) {
    error.value = 'Unable to load upload requests.'
  } finally {
    loading.value = false
  }
})

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatSize(bytes) {
  const value = Number(bytes) || 0
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function nextAction(request) {
  const map = {
    PENDING: 'Waiting for administrator approval.',
    APPROVED: 'Approved and published for everyone.',
    REJECTED: 'This request was rejected. Review the reason before resubmitting.',
    COMPLETED: 'Published. Other users can now find and download this material.',
    FAILED: 'Upload failed. Please submit a new request.'
  }
  return map[request.status] ?? 'Track this request from here.'
}

function displayStatus(status) {
  if (status === 'COMPLETED') return 'Published'
  if (status === 'FAILED') return 'Rejected'
  return status.charAt(0) + status.slice(1).toLowerCase()
}

async function downloadFile(request) {
  error.value = ''
  downloadingId.value = request.id
  try {
    const publishedId = request.documentType === 'Lecture' ? request.lectureId : request.sheetId
    const blob = request.status === 'COMPLETED' && publishedId
      ? await uploadApi.downloadPublishedFile({ documentType: request.documentType, publishedId })
      : await uploadApi.downloadUploadRequestFile(request.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = request.fileName || 'download'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (_err) {
    error.value = 'Unable to download this file.'
  } finally {
    downloadingId.value = ''
  }
}
</script>

<template>
  <section class="page-panel">
    <div class="panel__header">
      <div>
        <p class="eyebrow">History</p>
        <h1>My Uploads</h1>
        <p>Track submitted files from review through publication.</p>
      </div>
      <span v-if="!loading && !error" class="count-pill">{{ filteredRequests.length }} requests</span>
    </div>

    <div class="request-tabs" aria-label="Filter upload requests by status">
      <button v-for="status in statuses" :key="status" class="tab-button" :class="{ 'tab-button--active': activeStatus === status }" type="button" @click="activeStatus = status">
        {{ status === 'ALL' ? 'All' : displayStatus(status) }}
      </button>
    </div>

    <div v-if="loading" class="loading-state skeleton-list">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>
    <p v-else-if="error" class="form-error">{{ error }}</p>

    <div v-else-if="filteredRequests.length" class="request-list">
      <article v-for="request in filteredRequests" :key="request.id" class="request-card">
        <div class="request-card__main">
          <span class="status" :class="`status--${request.status.toLowerCase()}`">{{ displayStatus(request.status) }}</span>
          <h2>{{ request.title || request.fileName }}</h2>
          <p>{{ request.fileName }} - {{ request.courseName || 'Course pending' }} - {{ request.documentType }} - Submitted {{ formatDate(request.createdAt) }}</p>
          <p v-if="request.status === 'REJECTED'" class="request-card__reason">Reason: {{ request.rejectionReason || 'No reason provided.' }}</p>
        </div>
        <button class="button button--ghost button--small" type="button" @click="openId = openId === request.id ? '' : request.id">
          {{ openId === request.id ? 'Hide details' : 'View details' }}
        </button>
      </article>
    </div>

    <div v-else class="empty-state">
      <h2>{{ requests.length ? 'No requests in this status' : 'No upload requests yet' }}</h2>
      <p>{{ requests.length ? 'Choose another status filter.' : 'Use Upload Material to submit a file for administrator review.' }}</p>
    </div>

    <section v-if="selectedRequest" class="request-details">
      <div class="panel__header">
        <div>
          <p class="eyebrow">Request details</p>
          <h2>{{ selectedRequest.title }}</h2>
        </div>
        <span class="status" :class="`status--${selectedRequest.status.toLowerCase()}`">{{ selectedRequest.status }}</span>
      </div>
      <UploadStatusTimeline :status="selectedRequest.status" />
      <dl class="detail-grid">
        <div><dt>File</dt><dd>{{ selectedRequest.fileName }}</dd></div>
        <div><dt>Size</dt><dd>{{ formatSize(selectedRequest.fileSize) }}</dd></div>
        <div><dt>Course</dt><dd>{{ selectedRequest.courseName || '-' }}</dd></div>
        <div><dt>Type</dt><dd>{{ selectedRequest.documentType || '-' }}</dd></div>
        <div><dt>Academic year</dt><dd>{{ selectedRequest.academicYear || '-' }}</dd></div>
        <div><dt>Semester</dt><dd>{{ selectedRequest.semester || '-' }}</dd></div>
        <div><dt>Duplicate review</dt><dd>{{ selectedRequest.duplicateStatus || 'NONE' }}</dd></div>
        <div><dt>Instructor</dt><dd>{{ selectedRequest.instructorName || '-' }}</dd></div>
        <div><dt>Admin decision</dt><dd>{{ selectedRequest.decidedByUsername || '-' }}</dd></div>
        <div><dt>Updated</dt><dd>{{ formatDate(selectedRequest.updatedAt) }}</dd></div>
      </dl>
      <div class="detail-actions">
        <button class="button button--primary" type="button" :disabled="downloadingId === selectedRequest.id" @click="downloadFile(selectedRequest)">
          {{ downloadingId === selectedRequest.id ? 'Downloading...' : 'Download file' }}
        </button>
      </div>
      <p v-if="selectedRequest.status === 'REJECTED'" class="form-error">{{ selectedRequest.rejectionReason || 'This request was rejected.' }}</p>
      <div class="next-action">{{ nextAction(selectedRequest) }}</div>
    </section>
  </section>
</template>
