<script setup>
import { computed, onMounted, ref } from 'vue'
import UploadStatusTimeline from '@/components/sheet/UploadStatusTimeline.vue'
import { sheetApi } from '@/services/api'

const requests = ref([])
const loading = ref(true)
const error = ref('')
const openId = ref('')
const downloadingId = ref('')

const selectedRequest = computed(() => requests.value.find((request) => request.id === openId.value))

onMounted(async () => {
  try {
    requests.value = (await sheetApi.uploadRequests()) ?? []
  } catch (err) {
    error.value = err.message
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

function nextAction(request) {
  const map = {
    PENDING: 'Waiting for administrator approval.',
    APPROVED: 'Your request has been approved. Continue from the Upload page to confirm document information.',
    REJECTED: 'This request was rejected.',
    COMPLETED: 'Your document has been successfully uploaded.',
    FAILED: 'Upload failed. Please submit a new request.'
  }
  return map[request.status] ?? 'Track this request from here.'
}

async function downloadFile(request) {
  error.value = ''
  downloadingId.value = request.id
  try {
    const blob = await sheetApi.downloadUploadRequestFile(request.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = request.fileName || 'download'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    error.value = err.message
  } finally {
    downloadingId.value = ''
  }
}
</script>

<template>
  <section class="page-panel">
    <div class="panel__header">
      <div>
        <p class="eyebrow">Requests</p>
        <h1>My Upload Requests</h1>
        <p>รายการชีทของผู้ใช้และสถานะการตรวจสอบ</p>
      </div>
    </div>
    <p v-if="loading">กำลังโหลดข้อมูล...</p>
    <p v-else-if="error" class="form-error">{{ error }}</p>

    <div v-else-if="requests.length" class="request-list">
      <article v-for="request in requests" :key="request.id" class="request-card">
        <div class="request-card__main">
          <span class="status" :class="`status--${request.status.toLowerCase()}`">
            {{ request.status }}
          </span>
          <h2>{{ request.fileName }}</h2>
          <p>{{ request.courseName || 'Course pending' }} · {{ request.documentType }}</p>
          <small>Submitted {{ formatDate(request.createdAt) }}</small>
          <p v-if="request.status === 'REJECTED'" class="request-card__reason">
            Reason: {{ request.rejectionReason || 'No reason provided.' }}
          </p>
        </div>
        <button class="button button--ghost" type="button" @click="openId = openId === request.id ? '' : request.id">
          View Details
        </button>
      </article>
    </div>

    <div v-else class="empty-state">
      <h2>No upload requests yet</h2>
      <p>Start from the Upload page to send a file for administrator approval.</p>
      <RouterLink class="button button--primary" to="/dashboard/upload">Upload</RouterLink>
    </div>

    <section v-if="selectedRequest" class="request-details">
      <div class="panel__header">
        <div>
          <p class="eyebrow">Request Details</p>
          <h2>{{ selectedRequest.title }}</h2>
        </div>
        <span class="status" :class="`status--${selectedRequest.status.toLowerCase()}`">
          {{ selectedRequest.status }}
        </span>
      </div>
      <UploadStatusTimeline :status="selectedRequest.status" />
      <dl class="detail-grid">
        <div><dt>File</dt><dd>{{ selectedRequest.fileName }}</dd></div>
        <div><dt>Size</dt><dd>{{ selectedRequest.fileSize }} bytes</dd></div>
        <div><dt>Course</dt><dd>{{ selectedRequest.courseName || '-' }}</dd></div>
        <div><dt>Document type</dt><dd>{{ selectedRequest.documentType || '-' }}</dd></div>
        <div><dt>Academic year</dt><dd>{{ selectedRequest.academicYear || '-' }}</dd></div>
        <div><dt>Instructor</dt><dd>{{ selectedRequest.instructorName || '-' }}</dd></div>
        <div><dt>Admin decision</dt><dd>{{ selectedRequest.decidedByUsername || '-' }}</dd></div>
        <div><dt>Updated</dt><dd>{{ formatDate(selectedRequest.updatedAt) }}</dd></div>
      </dl>
      <div class="detail-actions">
        <button
          class="button button--primary"
          type="button"
          :disabled="downloadingId === selectedRequest.id"
          @click="downloadFile(selectedRequest)"
        >
          {{ downloadingId === selectedRequest.id ? 'Downloading…' : 'Download file' }}
        </button>
      </div>
      <p v-if="selectedRequest.status === 'REJECTED'" class="form-error">
        {{ selectedRequest.rejectionReason || 'This request was rejected.' }}
      </p>
      <div class="next-action">{{ nextAction(selectedRequest) }}</div>
    </section>
  </section>
</template>
