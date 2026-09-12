<script setup>
import { onMounted, ref } from 'vue'
import { sheetApi } from '@/services/sheet.service'
import { adminApi } from '@/services/admin.service'

const metadata = ref({ courses: [], instructors: [], documentTypes: [] })
const loading = ref(false)
const message = ref('')
const error = ref('')
const fileInput = ref(null)
const MAX_FILE_BYTES = 20 * 1024 * 1024
const ACCEPTED_FILES = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png'
const MIME_BY_EXTENSION = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png'
}

const emptyForm = () => ({
  title: '', fileName: '', fileSize: 0, fileType: '', fileData: '',
  courseId: '', documentType: '', academicYear: '', semester: '', instructorId: '', uploadDate: ''
})

const form = ref(emptyForm())

function formatFileSize(bytes) {
  if (!bytes) return '0 bytes'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

onMounted(async () => {
  try {
    metadata.value = await sheetApi.metadata()
  } catch (_err) {
    error.value = 'Unable to load publishing metadata.'
  }
})

function resetFile() {
  form.value.fileName = ''
  form.value.fileSize = 0
  form.value.fileType = ''
  form.value.fileData = ''
  if (fileInput.value) fileInput.value.value = ''
}

function onFileChange(event) {
  error.value = ''
  const file = event.target.files?.[0]
  if (!file) return
  if (file.size > MAX_FILE_BYTES) {
    error.value = 'File is too large. Maximum size is 20 MB.'
    resetFile()
    return
  }
  form.value.fileName = file.name
  form.value.fileSize = file.size
  const extension = file.name.split('.').pop()?.toLowerCase()
  form.value.fileType = file.type && file.type !== 'application/octet-stream'
    ? file.type
    : MIME_BY_EXTENSION[extension] || ''
  const reader = new FileReader()
  reader.onload = () => { form.value.fileData = String(reader.result).split(',')[1] ?? '' }
  reader.onerror = () => { error.value = 'Could not read the selected file.' }
  reader.readAsDataURL(file)
  if (!form.value.title) form.value.title = file.name.replace(/\.[^.]+$/, '')
}

async function submitUpload() {
  error.value = ''
  message.value = ''
  if (!form.value.fileData) {
    error.value = 'Choose a file before publishing.'
    return
  }
  loading.value = true
  try {
    const request = await adminApi.adminCreateUploadRequest(form.value)
    message.value = `"${request.fileName}" was published to the ${request.documentType} catalog.`
    form.value = emptyForm()
    if (fileInput.value) fileInput.value.value = ''
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="page-panel upload-flow">
    <div class="panel__header">
      <div>
        <p class="eyebrow">Admin publish</p>
        <h1>Publish Material</h1>
        <p>Validate and publish a Lecture or Sheet directly as an administrator.</p>
      </div>
    </div>

    <div v-if="message" class="form-success">{{ message }}</div>
    <div v-if="error" class="form-error">{{ error }}</div>

    <form class="form request-form" @submit.prevent="submitUpload">
      <section class="upload-dropzone">
        <input ref="fileInput" type="file" :accept="ACCEPTED_FILES" required @change="onFileChange" />
        <span class="upload-dropzone__title">Choose a publish-ready file</span>
        <span class="upload-dropzone__hint">The material becomes public immediately after validation.</span>
        <div v-if="form.fileName" class="upload-file">
          <span>{{ form.fileName }} - {{ formatFileSize(form.fileSize) }}</span>
          <button class="button button--ghost button--small" type="button" @click.stop="resetFile">Remove</button>
        </div>
      </section>
      <label>Document title<input v-model="form.title" required placeholder="Database lecture deck" /></label>
      <div class="form-grid">
        <label>Course<select v-model="form.courseId" required><option value="" disabled>Select course</option><option v-for="course in metadata.courses" :key="course.id" :value="course.id">{{ course.name }}</option></select></label>
        <label>Type<select v-model="form.documentType" required><option value="" disabled>Select type</option><option v-for="type in metadata.documentTypes" :key="type" :value="type">{{ type }}</option></select></label>
        <label>Academic year<input v-model="form.academicYear" required inputmode="numeric" pattern="[0-9]{4}" placeholder="2568" /></label>
        <label>Semester<input v-model="form.semester" required maxlength="30" placeholder="1" /></label>
        <label>Instructor<select v-model="form.instructorId" required><option value="" disabled>Select instructor</option><option v-for="instructor in metadata.instructors" :key="instructor.id" :value="instructor.id">{{ instructor.name }}</option></select></label>
        <label>Date<input v-model="form.uploadDate" type="date" /></label>
      </div>
      <button class="button button--primary" :disabled="loading" type="submit">{{ loading ? 'Publishing...' : 'Publish material' }}</button>
    </form>
  </section>
</template>
