<script setup>
import { onMounted, ref } from 'vue'
import { sheetApi } from '@/services/sheet.service'
import { uploadApi } from '@/services/upload.service'

const emit = defineEmits(['uploaded'])

const metadata = ref({ courses: [], instructors: [], documentTypes: [] })
const loading = ref(false)
const message = ref('')
const error = ref('')
const fileInput = ref(null)

const emptyForm = () => ({
  title: '',
  fileName: '',
  fileSize: 0,
  fileType: '',
  fileData: '',
  courseId: '',
  documentType: '',
  academicYear: '',
  semester: '',
  instructorId: ''
})

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

function formatFileSize(bytes) {
  if (!bytes) return '0 bytes'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const form = ref(emptyForm())

onMounted(async () => {
  try {
    metadata.value = await sheetApi.metadata()
  } catch (_err) {
    error.value = 'Unable to load upload metadata.'
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
  form.value.fileData = ''
  const reader = new FileReader()
  reader.onload = () => {
    form.value.fileData = String(reader.result).split(',')[1] ?? ''
  }
  reader.onerror = () => {
    error.value = 'Could not read the selected file.'
    form.value.fileData = ''
  }
  reader.readAsDataURL(file)
  if (!form.value.title) form.value.title = file.name.replace(/\.[^.]+$/, '')
}

async function submitUpload() {
  error.value = ''
  message.value = ''
  if (!form.value.fileData) {
    error.value = 'Choose a file before submitting.'
    return
  }
  loading.value = true
  try {
    const request = await uploadApi.createUploadRequest(form.value)
    message.value = `"${request.fileName}" was submitted for administrator review.`
    form.value = emptyForm()
    if (fileInput.value) fileInput.value.value = ''
    emit('uploaded', request)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="form request-form" @submit.prevent="submitUpload">
    <div v-if="message" class="form-success">{{ message }}</div>
    <div v-if="error" class="form-error">{{ error }}</div>

    <section class="upload-dropzone">
      <input ref="fileInput" type="file" :accept="ACCEPTED_FILES" required @change="onFileChange" />
      <span class="upload-dropzone__title">Choose a file</span>
      <span class="upload-dropzone__hint">PDF, Office files, text, JPG, or PNG up to 20 MB.</span>
      <div v-if="form.fileName" class="upload-file">
        <span>{{ form.fileName }} - {{ formatFileSize(form.fileSize) }}</span>
        <button class="button button--ghost button--small" type="button" @click.stop="resetFile">Remove</button>
      </div>
    </section>

    <label>
      Document title
      <input v-model="form.title" required placeholder="Algorithm summary" />
    </label>

    <div class="form-grid">
      <label>
        Course
        <select v-model="form.courseId" required>
          <option value="" disabled>Select course</option>
          <option v-for="course in metadata.courses" :key="course.id" :value="course.id">{{ course.name }}</option>
        </select>
      </label>
      <label>
        Type
        <select v-model="form.documentType" required>
          <option value="" disabled>Lecture or Sheet</option>
          <option v-for="type in metadata.documentTypes" :key="type" :value="type">{{ type }}</option>
        </select>
      </label>
      <label>Academic year<input v-model="form.academicYear" required inputmode="numeric" pattern="[0-9]{4}" placeholder="2568" /></label>
      <label>Semester<input v-model="form.semester" required maxlength="30" placeholder="1" /></label>
      <label>
        Instructor
        <select v-model="form.instructorId" required>
          <option value="" disabled>Select instructor</option>
          <option v-for="instructor in metadata.instructors" :key="instructor.id" :value="instructor.id">{{ instructor.name }}</option>
        </select>
      </label>
    </div>

    <p class="section-copy">Your upload will be reviewed by an administrator before it becomes public.</p>
    <button class="button button--primary" :disabled="loading" type="submit">
      {{ loading ? 'Submitting...' : 'Submit for review' }}
    </button>
  </form>
</template>
