<script setup>
import { onMounted, reactive, ref } from 'vue'
import { adminApi } from '@/services/admin.service'
import { sheetApi } from '@/services/sheet.service'

const collections = ref([])
const metadata = ref({ programs: [], courses: [], academicYears: [], semesters: ['1', '2'], documentTypes: ['Lecture', 'Sheet'] })
const form = reactive({ name: '', description: '' })
const bulk = reactive({ collectionId: '', programId: '', courseId: '', academicYear: '', semester: '', documentType: 'Sheet', files: [] })
const job = ref(null); const loading = ref(false); const error = ref(''); const message = ref('')
const MIME = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }

async function load() { collections.value = await adminApi.collections(); metadata.value = await sheetApi.metadata() }
onMounted(() => load().catch(cause => { error.value = cause.message }))

async function create() {
  loading.value = true; error.value = ''; message.value = ''
  try { const created = await adminApi.createCollection({ ...form }); collections.value.unshift(created); bulk.collectionId = created.id; form.name = ''; form.description = ''; message.value = 'สร้าง Collection แล้ว' }
  catch (cause) { error.value = cause.message } finally { loading.value = false }
}

async function toggle(collection) {
  const status = collection.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE'
  try { Object.assign(collection, await adminApi.updateCollection(collection.id, { status })) } catch (cause) { error.value = cause.message }
}

function readFile(file, index) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = reject
    reader.onload = () => resolve({ clientKey: `file-${Date.now()}-${index}`, title: file.name.replace(/\.[^.]+$/, ''), fileName: file.name, fileType: file.type || MIME[file.name.split('.').pop()?.toLowerCase()] || '', fileData: String(reader.result).split(',')[1] || '' })
    reader.readAsDataURL(file)
  })
}

async function chooseFiles(event) {
  error.value = ''; const files = [...(event.target.files || [])]
  if (files.length > 20 || files.some(file => file.size > 20 * 1024 * 1024)) { error.value = 'เลือกได้ไม่เกิน 20 ไฟล์ และแต่ละไฟล์ต้องไม่เกิน 20 MB'; event.target.value = ''; return }
  try { bulk.files = await Promise.all(files.map(readFile)) } catch { error.value = 'อ่านไฟล์ไม่สำเร็จ'; bulk.files = [] }
}

function payload(files) { return files.map(file => ({ ...file, programId: bulk.programId, courseId: bulk.courseId, academicYear: bulk.academicYear, semester: bulk.semester, documentType: bulk.documentType })) }
async function submitBulk() {
  loading.value = true; error.value = ''; message.value = ''
  try { job.value = await adminApi.createBulkUpload({ collectionId: bulk.collectionId, items: payload(bulk.files) }); message.value = `รับ ${job.value.succeededItems}/${job.value.totalItems} ไฟล์เข้าสู่คิวอนุมัติ` }
  catch (cause) { error.value = cause.message } finally { loading.value = false }
}
async function retry(item) {
  const original = bulk.files.find(file => file.clientKey === item.clientKey)
  if (!original) return
  try { job.value = await adminApi.retryBulkUpload(job.value.id, payload([original])) } catch (cause) { error.value = cause.message }
}
</script>

<template>
  <section class="page-panel collection-admin">
    <div class="panel__header"><div><p class="eyebrow">Collection management</p><h1>Collections และ Bulk Upload</h1><p>จัดกลุ่มเอกสารและส่งหลายไฟล์เข้าสู่คิวอนุมัติ โดยแยกผลสำเร็จและล้มเหลวรายไฟล์</p></div></div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="message" class="form-success" role="status">{{ message }}</p>
    <div class="collection-admin__grid">
      <section><h2>Collections</h2><form class="form" @submit.prevent="create"><label>ชื่อ<input v-model="form.name" minlength="2" maxlength="120" required></label><label>คำอธิบาย<textarea v-model="form.description" maxlength="1000" rows="3" /></label><button class="button button--primary" :disabled="loading">สร้าง Collection</button></form>
        <div class="collection-list"><article v-for="collection in collections" :key="collection.id"><div><strong>{{ collection.name }}</strong><p>{{ collection.documentCount }} เอกสาร · {{ collection.status }}</p></div><button class="button button--ghost button--small" type="button" @click="toggle(collection)">{{ collection.status === 'ACTIVE' ? 'เก็บถาวร' : 'เปิดใช้งาน' }}</button></article></div>
      </section>
      <section><h2>Bulk Upload</h2><form class="form" @submit.prevent="submitBulk"><div class="form-grid"><label>Collection<select v-model="bulk.collectionId"><option value="">ไม่จัด Collection</option><option v-for="collection in collections.filter(item => item.status === 'ACTIVE')" :key="collection.id" :value="collection.id">{{ collection.name }}</option></select></label><label>สาขา<select v-model="bulk.programId" required><option value="" disabled>เลือกสาขา</option><option v-for="program in metadata.programs" :key="program.id" :value="program.id">{{ program.nameTh || program.code }}</option></select></label><label>รายวิชา<select v-model="bulk.courseId" required><option value="" disabled>เลือกรายวิชา</option><option v-for="course in metadata.courses" :key="course.id" :value="course.id">{{ course.code }} — {{ course.nameEn || course.name }}</option></select></label><label>ปีการศึกษา<select v-model="bulk.academicYear" required><option value="" disabled>เลือกปี</option><option v-for="year in metadata.academicYears" :key="year">{{ year }}</option></select></label><label>ภาคเรียน<select v-model="bulk.semester" required><option value="" disabled>เลือกภาคเรียน</option><option v-for="semester in metadata.semesters" :key="semester">{{ semester }}</option></select></label><label>ประเภท<select v-model="bulk.documentType"><option value="Sheet">ชีทสรุป</option><option value="Lecture">เอกสารการสอน</option></select></label></div><label>ไฟล์ (สูงสุด 20)<input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" required @change="chooseFiles"></label><p>{{ bulk.files.length }} ไฟล์พร้อมส่ง</p><button class="button button--primary" :disabled="loading || !bulk.files.length">ส่งเข้าคิวอนุมัติ</button></form>
        <div v-if="job" class="bulk-result"><h3>ผลการประมวลผล: {{ job.status }}</h3><p>สำเร็จ {{ job.succeededItems }} · ล้มเหลว {{ job.failedItems }}</p><article v-for="item in job.items" :key="item.id" :data-bulk-status="item.status"><div><strong>{{ item.clientKey }}</strong><p>{{ item.status }}<span v-if="item.errorMessage"> — {{ item.errorMessage }}</span></p></div><button v-if="item.status === 'FAILED'" class="button button--ghost button--small" type="button" @click="retry(item)">ลองใหม่</button></article></div>
      </section>
    </div>
  </section>
</template>
