<script setup>
import { onMounted, ref } from 'vue'
import { adminApi } from '@/services/admin.service'

const requests = ref([])
const loading = ref(true)
const error = ref('')
const downloadingId = ref('')

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    requests.value = await adminApi.adminUploadRequests()
  } catch (_err) {
    error.value = 'Unable to load upload requests.'
  } finally {
    loading.value = false
  }
}

async function previewFile(request) {
  error.value = ''
  downloadingId.value = request.id
  try {
    const blob = await adminApi.adminDownloadUploadRequestFile(request.id)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (_err) {
    error.value = 'Unable to download the uploaded file.'
  } finally {
    downloadingId.value = ''
  }
}

async function rejectDuplicate(id) {
  error.value = ''
  try { await adminApi.rejectDuplicateUploadRequest(id); await loadData() } catch (err) { error.value = err.message }
}

async function approve(id) {
  error.value = ''
  try {
    await adminApi.approveUploadRequest(id, {})
    await loadData()
  } catch (err) {
    error.value = err.message
  }
}

async function reject(id) {
  const reason = window.prompt('Reason for rejection')
  if (reason === null) return
  error.value = ''
  try {
    await adminApi.rejectUploadRequest(id, reason.trim() || 'Did not meet the review criteria')
    await loadData()
  } catch (err) {
    error.value = err.message
  }
}

onMounted(loadData)
</script>

<template>
  <section class="page-panel">
    <div class="panel__header">
      <div>
        <p class="eyebrow">Admin review</p>
        <h1>Upload Requests</h1>
        <p>Review pending submissions and publish the correct Lecture or Sheet record.</p>
      </div>
      <span v-if="!loading && !error" class="count-pill">{{ requests.length }} requests</span>
    </div>

    <div v-if="error" class="form-error">{{ error }}</div>
    <div v-if="loading" class="loading-state skeleton-list"><div class="skeleton-line"></div><div class="skeleton-line"></div></div>
    <div v-else-if="!requests.length" class="empty-state"><h2>No upload requests</h2><p>New student submissions will appear here.</p></div>

    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Title</th>
            <th>Course</th>
            <th>Type</th>
            <th>Year / Instructor</th>
            <th>User</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in requests" :key="request.id">
            <td>
              <button class="button button--small button--ghost" type="button" :disabled="downloadingId === request.id" @click="previewFile(request)">
                {{ downloadingId === request.id ? 'Opening...' : request.fileName }}
              </button>
            </td>
            <td>{{ request.title }}</td>
            <td>{{ request.courseName || '-' }}</td>
            <td>{{ request.documentType }}</td>
            <td>{{ request.academicYear || '-' }} / Semester {{ request.semester || '-' }} / {{ request.instructorName || '-' }}</td>
            <td>{{ request.username }}</td>
            <td><span class="status" :class="`status--${request.status.toLowerCase()}`">{{ request.status }}</span></td>
            <td class="table-actions">
              <template v-if="request.status === 'PENDING'">
                <button class="button button--small button--primary" type="button" @click="approve(request.id)">Approve</button>
                <button class="button button--small button--danger" type="button" @click="reject(request.id)">Reject</button>
                <button v-if="request.duplicateStatus !== 'NONE'" class="button button--small button--danger" type="button" @click="rejectDuplicate(request.id)">Reject as Duplicate</button>
              </template>
              <span v-else class="material-meta">Reviewed</span>
            </td>
          </tr>
          <tr v-for="request in requests.filter((item) => item.duplicateStatus !== 'NONE')" :key="`${request.id}-duplicates`">
            <td colspan="8"><strong>{{ request.duplicateStatus }}</strong> — {{ request.duplicateMatches.length }} match(es): {{ request.duplicateMatches.map((match) => `${match.title} (${match.source})`).join(', ') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
