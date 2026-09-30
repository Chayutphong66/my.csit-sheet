<script setup>
import { ref } from 'vue'
import { documentApi } from '@/services/document.service'

const props = defineProps({ document: { type: Object, required: true } })
const emit = defineEmits(['submitted', 'cancel'])
const form = ref({ revisionType: 'ADD_CONTENT', changeSummary: '', fileName: '', fileType: '', fileData: '' })
const fileInput = ref(null); const busy = ref(false); const error = ref('')
const MAX_BYTES = 20 * 1024 * 1024
const MIME = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }
function chooseFile(event) {
  error.value = ''; const file = event.target.files?.[0]; if (!file) return
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!MIME[extension] || file.size > MAX_BYTES) { error.value = 'รองรับไฟล์เอกสารหรือรูปภาพขนาดไม่เกิน 20 MB'; event.target.value = ''; return }
  const reader = new FileReader()
  reader.onload = () => { form.value = { ...form.value, fileName: file.name, fileType: MIME[extension], fileData: String(reader.result).split(',')[1] || '' } }
  reader.onerror = () => { error.value = 'ไม่สามารถอ่านไฟล์นี้ได้' }
  reader.readAsDataURL(file)
}
async function submit() {
  error.value = ''
  if (!form.value.fileData) { error.value = 'กรุณาเลือกไฟล์ฉบับแก้ไข'; return }
  busy.value = true
  try { emit('submitted', await documentApi.submitRevision(props.document, form.value)) }
  catch (caught) { error.value = caught.message }
  finally { busy.value = false }
}
</script>

<template>
  <form id="submit-revision" class="revision-form form" @submit.prevent="submit">
    <div class="section-heading"><div><p class="eyebrow">Contribute Revision</p><h2>เสนอการแก้ไขเอกสาร</h2><p>เวอร์ชันปัจจุบันจะไม่เปลี่ยนจนกว่าผู้ดูแลจะอนุมัติ</p></div></div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <label>ประเภทการแก้ไข<select v-model="form.revisionType" required><option value="ADD_CONTENT">เพิ่มเนื้อหา</option><option value="CORRECT_CONTENT">แก้ไขเนื้อหา</option><option value="REMOVE_INCORRECT">ลบหรือแก้ข้อมูลที่ไม่ถูกต้อง</option><option value="UPDATE_DOCUMENT">อัปเดตเอกสาร</option><option value="NEW_ACADEMIC_YEAR">อัปเดตสำหรับปีการศึกษาใหม่</option><option value="OTHER">อื่น ๆ</option></select></label>
    <label>สรุปสิ่งที่เปลี่ยนแปลง<textarea v-model.trim="form.changeSummary" required minlength="5" maxlength="1000" rows="4" placeholder="เช่น เพิ่มเนื้อหา REST API และปรับตัวอย่างในหน้า 18–23" /></label>
    <label>ไฟล์ฉบับแก้ไข<input ref="fileInput" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" required @change="chooseFile" /><small v-if="form.fileName">{{ form.fileName }}</small></label>
    <div class="table-actions"><button class="button button--primary" :disabled="busy">{{ busy ? 'กำลังส่ง…' : 'ส่งให้ผู้ดูแลตรวจสอบ' }}</button><button class="button button--ghost" type="button" :disabled="busy" @click="$emit('cancel')">ยกเลิก</button></div>
  </form>
</template>
