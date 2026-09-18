<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { sheetApi } from '@/services/sheet.service'
import { adminApi } from '@/services/admin.service'

const metadata = ref({ programs: [], courses: [], academicYears: [], semesters: ['1', '2'], documentTypes: [] })
const teachers = ref([])
const teacherLoading = ref(false)
let teacherGeneration = 0
const loading = ref(false)
const message = ref('')
const error = ref('')
const fileInput = ref(null)
const importInput = ref(null)
const importLoading = ref(false)
const importMessage = ref('')
const importError = ref('')
const importHistory = ref([])
const registrar = ref({ fileName: '', fileData: '', program: 'CS', previewToken: '', preview: null, destructiveSync: false, confirmDestructive: false })
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
  title: '', description: '', fileName: '', fileSize: 0, fileType: '', fileData: '',
  programId: '', courseId: '', documentType: '', academicYear: '', semester: '', instructorId: '', uploadDate: ''
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
    error.value = 'โหลดข้อมูลสำหรับเผยแพร่ไม่สำเร็จ'
  }
  try { importHistory.value = (await adminApi.courseImportHistory()).imports || [] } catch { /* import remains usable */ }
})
watch(() => [form.value.programId, form.value.academicYear, form.value.semester, form.value.courseId], async ([programId, year, term, courseId]) => {
  const current = ++teacherGeneration; form.value.instructorId = ''; teachers.value = []
  if (!programId || !year || !term || !courseId) return
  teacherLoading.value = true
  try { const result = await sheetApi.teachers(courseId, year, term, programId); if (current === teacherGeneration) teachers.value = result.teachers || [] }
  catch { if (current === teacherGeneration) error.value = 'โหลดข้อมูลผู้สอนไม่สำเร็จ' }
  finally { if (current === teacherGeneration) teacherLoading.value = false }
})
onBeforeUnmount(() => { teacherGeneration++ })

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
    error.value = 'ไฟล์มีขนาดเกิน 20 MB'
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
  reader.onerror = () => { error.value = 'ไม่สามารถอ่านไฟล์ที่เลือกได้' }
  reader.readAsDataURL(file)
  if (!form.value.title) form.value.title = file.name.replace(/\.[^.]+$/, '')
}

async function submitUpload() {
  error.value = ''
  message.value = ''
  if (!form.value.fileData) {
    error.value = 'กรุณาเลือกไฟล์ก่อนเผยแพร่'
    return
  }
  loading.value = true
  try {
    const request = await adminApi.adminCreateUploadRequest(form.value)
    message.value = `เผยแพร่ “${request.fileName}” ในคลังเอกสารแล้ว`
    form.value = emptyForm()
    if (fileInput.value) fileInput.value.value = ''
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function onImportFile(event) {
  importError.value = ''; importMessage.value = ''; registrar.value.preview = null; registrar.value.previewToken = ''
  const file = event.target.files?.[0]
  if (!file) return
  if (!/\.xlsx$/i.test(file.name) || file.size > MAX_FILE_BYTES) { importError.value = 'กรุณาเลือกไฟล์ .xlsx ขนาดไม่เกิน 20 MB'; event.target.value = ''; return }
  registrar.value.fileName = file.name
  const reader = new FileReader()
  reader.onload = () => { registrar.value.fileData = String(reader.result).split(',')[1] || '' }
  reader.onerror = () => { importError.value = 'ไม่สามารถอ่านไฟล์ทะเบียนได้' }
  reader.readAsDataURL(file)
}

async function previewImport() {
  importError.value = ''; importMessage.value = ''
  if (!registrar.value.fileData) { importError.value = 'กรุณาเลือกไฟล์ทะเบียนก่อน'; return }
  importLoading.value = true
  try {
    const result = await adminApi.previewCourseImport({ fileName: registrar.value.fileName, fileData: registrar.value.fileData, program: registrar.value.program })
    registrar.value.preview = result; registrar.value.previewToken = result.previewToken
  } catch (err) { importError.value = err.message }
  finally { importLoading.value = false }
}

async function confirmImport() {
  importError.value = ''; importMessage.value = ''
  if (!registrar.value.previewToken) { importError.value = 'กรุณาตรวจตัวอย่างการนำเข้าก่อน'; return }
  importLoading.value = true
  try {
    const result = await adminApi.confirmCourseImport({
      fileName: registrar.value.fileName, fileData: registrar.value.fileData, program: registrar.value.program,
      previewToken: registrar.value.previewToken, destructiveSync: registrar.value.destructiveSync,
      confirmDestructive: registrar.value.confirmDestructive
    })
    importMessage.value = `นำเข้าแล้ว ${result.importedRows} รายการ เพิ่มรายวิชา ${result.createdCourses} และผู้สอน ${result.createdTeachers}`
    importHistory.value = (await adminApi.courseImportHistory()).imports || []
    registrar.value.preview = null; registrar.value.previewToken = ''
  } catch (err) { importError.value = err.message }
  finally { importLoading.value = false }
}
</script>

<template>
  <section class="page-panel upload-flow">
    <div class="panel__header">
      <div>
        <p class="eyebrow">Admin publish</p>
        <h1>เผยแพร่เอกสารโดยตรง</h1>
        <p>ตรวจข้อมูลและเผยแพร่เอกสารการสอนหรือชีทสรุปในฐานะผู้ดูแล</p>
      </div>
    </div>

    <div v-if="message" class="form-success">{{ message }}</div>
    <div v-if="error" class="form-error">{{ error }}</div>

    <form class="form request-form" @submit.prevent="submitUpload">
      <section class="upload-dropzone">
        <input ref="fileInput" type="file" :accept="ACCEPTED_FILES" required @change="onFileChange" />
        <span class="upload-dropzone__title">เลือกไฟล์ที่พร้อมเผยแพร่</span>
        <span class="upload-dropzone__hint">รายการจะเข้าสู่คลังสาธารณะทันทีหลังผ่าน validation</span>
        <div v-if="form.fileName" class="upload-file">
          <span>{{ form.fileName }} - {{ formatFileSize(form.fileSize) }}</span>
          <button class="button button--ghost button--small" type="button" @click.stop="resetFile">นำไฟล์ออก</button>
        </div>
      </section>
      <label>ชื่อเอกสาร<input v-model="form.title" required placeholder="เช่น สไลด์ Database บทที่ 1" /></label>
      <label>คำอธิบายเพิ่มเติม<textarea v-model.trim="form.description" maxlength="1000" rows="3" /></label>
      <div class="form-grid">
        <label>สาขา<select v-model="form.programId" required><option value="" disabled>เลือกสาขา</option><option v-for="program in metadata.programs" :key="program.id" :value="program.id">{{ program.nameTh }}</option></select></label>
        <label>รายวิชา<select v-model="form.courseId" required><option value="" disabled>เลือกรายวิชา</option><option v-for="course in metadata.courses" :key="course.id" :value="course.id">{{ course.code }} - {{ course.nameEn || course.name }}</option></select></label>
        <label>ประเภท<select v-model="form.documentType" required><option value="" disabled>เลือกประเภท</option><option v-for="type in metadata.documentTypes" :key="type" :value="type">{{ type === 'Lecture' ? 'เอกสารการสอน' : 'ชีทสรุป' }}</option></select></label>
        <label>ปีการศึกษา<select v-model="form.academicYear" required><option value="" disabled>เลือกปี</option><option v-for="year in metadata.academicYears" :key="year">{{ year }}</option></select></label>
        <label>ภาคเรียน<select v-model="form.semester" required><option value="" disabled>เลือกภาคเรียน</option><option v-for="term in metadata.semesters" :key="term">{{ term }}</option></select></label>
        <label>ผู้สอน<select v-model="form.instructorId" :disabled="teacherLoading || !form.courseId || !form.academicYear || !form.semester"><option value="">ไม่ระบุอาจารย์</option><option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">{{ teacher.name }}</option></select><small v-if="teacherLoading">กำลังโหลดข้อมูลผู้สอน...</small></label>
        <label>วันที่เอกสาร<input v-model="form.uploadDate" type="date" /></label>
      </div>
      <button class="button button--primary" :disabled="loading" type="submit">{{ loading ? 'กำลังเผยแพร่…' : 'เผยแพร่เอกสาร' }}</button>
    </form>

    <section class="registrar-import">
      <div class="section-heading"><div><p class="eyebrow">Registrar import</p><h2>นำเข้ารายวิชาและผู้สอน</h2><p>ตรวจตัวอย่างก่อนยืนยัน ระบบจะเพิ่มข้อมูลแบบปลอดภัยและไม่ลบความสัมพันธ์เดิม</p></div></div>
      <div v-if="importMessage" class="form-success">{{ importMessage }}</div>
      <div v-if="importError" class="form-error">{{ importError }}</div>
      <form class="form" @submit.prevent="previewImport">
        <div class="form-grid">
          <label>สาขา<select v-model="registrar.program" @change="registrar.preview = null; registrar.previewToken = ''"><option value="CS">CS — Computer Science</option><option value="IT">IT — Information Technology</option></select></label>
          <label>ไฟล์ทะเบียน (.xlsx)<input ref="importInput" type="file" accept=".xlsx" required @change="onImportFile" /></label>
        </div>
        <button class="button button--ghost" type="submit" :disabled="importLoading">{{ importLoading ? 'กำลังตรวจ…' : 'สร้างตัวอย่างการนำเข้า' }}</button>
      </form>

      <div v-if="registrar.preview" class="import-preview">
        <h3>ตัวอย่าง: {{ registrar.preview.fileName }} · {{ registrar.preview.program }}</h3>
        <div class="import-preview-grid">
          <article><strong>{{ registrar.preview.totalRows }}</strong><span>แถวทั้งหมด</span></article>
          <article><strong>{{ registrar.preview.newCourses }}</strong><span>รายวิชาใหม่</span></article>
          <article><strong>{{ registrar.preview.updatedCourses }}</strong><span>รายวิชาที่อัปเดต</span></article>
          <article><strong>{{ registrar.preview.newTeachers }}</strong><span>ผู้สอนใหม่</span></article>
          <article><strong>{{ registrar.preview.newCourseOfferings }}</strong><span>การเปิดสอนใหม่</span></article>
          <article><strong>{{ registrar.preview.newTeacherAssignments }}</strong><span>ความสัมพันธ์ผู้สอนใหม่</span></article>
          <article><strong>{{ registrar.preview.existingRows }}</strong><span>รายการเดิม</span></article>
          <article><strong>{{ registrar.preview.invalidRows }}</strong><span>แถวผิดพลาด</span></article>
        </div>
        <label class="check-row"><input v-model="registrar.destructiveSync" type="checkbox" /> ซิงก์แบบลบผู้สอนเดิมที่ไม่อยู่ในไฟล์ (ใช้เมื่อจำเป็นเท่านั้น)</label>
        <label v-if="registrar.destructiveSync" class="check-row warning"><input v-model="registrar.confirmDestructive" type="checkbox" /> ฉันยืนยันการลบความสัมพันธ์ผู้สอนเดิม</label>
        <button class="button button--primary" type="button" :disabled="importLoading || (registrar.destructiveSync && !registrar.confirmDestructive)" @click="confirmImport">ยืนยันนำเข้าฐานข้อมูล</button>
      </div>

      <div v-if="importHistory.length" class="import-history">
        <h3>ประวัติการนำเข้าล่าสุด</h3>
        <div class="request-list"><article v-for="item in importHistory.slice(0, 5)" :key="item.id" class="request-card"><div><strong>{{ item.fileName }}</strong><p>{{ item.program }} · {{ item.importedRows }} รายการ · {{ item.importedByUsername || 'Initial import' }}</p></div><span class="status-badge">{{ item.status }}</span></article></div>
      </div>
    </section>
  </section>
</template>
