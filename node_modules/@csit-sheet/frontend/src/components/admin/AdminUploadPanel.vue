<script setup>
import { onMounted, ref } from 'vue'
import { sheetApi } from '@/services/api'

const metadata = ref({ courses: [], instructors: [], documentTypes: [], academicYears: [] })
const users = ref([])
const loading = ref(false)
const message = ref('')
const error = ref('')
const fileInput = ref(null)

const emptyForm = () => ({
  title: '',
  fileName: '',
  fileSize: 0,
  fileType: '',
  courseId: '',
  uploadDate: '',
  userId: ''
})

const form = ref(emptyForm())

onMounted(async () => {
  try {
    const [meta, userList] = await Promise.all([sheetApi.metadata(), sheetApi.adminUsers()])
    metadata.value = meta
    users.value = userList
  } catch (err) {
    error.value = err.message
  }
})

function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  form.value.fileName = file.name
  form.value.fileSize = file.size
  form.value.fileType = file.type || 'application/octet-stream'
  if (!form.value.title) form.value.title = file.name.replace(/\.[^.]+$/, '')
}

async function submitUpload() {
  error.value = ''
  message.value = ''
  loading.value = true
  try {
    const request = await sheetApi.adminCreateUploadRequest(form.value)
    message.value = `"${request.fileName}" was added and now appears under Request as PENDING.`
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
        <p class="eyebrow">Admin</p>
        <h1>Upload</h1>
        <p>Add a document on behalf of a user. It will appear in the Request list for review.</p>
      </div>
    </div>

    <div v-if="message" class="form-success">{{ message }}</div>
    <div v-if="error" class="form-error">{{ error }}</div>

    <form class="form request-form" @submit.prevent="submitUpload">
      <label>
        File
        <input ref="fileInput" type="file" required @change="onFileChange" />
      </label>
      <label>
        Document title
        <input v-model="form.title" required placeholder="Algorithm summary" />
      </label>
      <div class="form-grid">
        <label>
          Category
          <select v-model="form.courseId" required>
            <option value="" disabled>Select category</option>
            <option v-for="course in metadata.courses" :key="course.id" :value="course.id">
              {{ course.name }}
            </option>
          </select>
        </label>
        <label>
          Date
          <input v-model="form.uploadDate" type="date" required />
        </label>
        <label>
          User who uploaded
          <select v-model="form.userId" required>
            <option value="" disabled>Select user</option>
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.username }}
            </option>
          </select>
        </label>
      </div>
      <button class="button button--primary" :disabled="loading" type="submit">Submit Upload</button>
    </form>
  </section>
</template>
