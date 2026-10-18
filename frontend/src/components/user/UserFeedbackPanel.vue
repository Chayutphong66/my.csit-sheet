<script setup>
import { onMounted, reactive, ref } from 'vue'
import { feedbackApi } from '@/services/feedback.service'

const categories = [['BUG', 'ปัญหาการใช้งาน'], ['FEEDBACK', 'ข้อเสนอแนะ'], ['FEATURE_REQUEST', 'เสนอฟีเจอร์'], ['INCORRECT_CONTENT', 'ข้อมูลเอกสารไม่ถูกต้อง']]
const form = reactive({ category: 'BUG', subject: '', description: '', relatedPath: '', relatedDocumentType: '', relatedDocumentId: '' })
const reports = ref([]); const selected = ref(null); const loading = ref(true); const busy = ref(false); const error = ref(''); const success = ref('')
let clientRequestId = crypto.randomUUID()
async function load() { reports.value = (await feedbackApi.mine({ limit: 50 })).items }
async function open(reference) { selected.value = await feedbackApi.detail(reference) }
async function submit() {
  busy.value = true; error.value = ''; success.value = ''
  try {
    const result = await feedbackApi.submit({ ...form, clientRequestId })
    success.value = `รับเรื่องแล้ว หมายเลข ${result.reference}${result.replayed ? ' (คำขอเดิม)' : ''}`
    Object.assign(form, { category: 'BUG', subject: '', description: '', relatedPath: '', relatedDocumentType: '', relatedDocumentId: '' })
    clientRequestId = crypto.randomUUID(); await load(); await open(result.reference)
  } catch (caught) { error.value = caught.message } finally { busy.value = false }
}
onMounted(async () => { try { await load() } catch (caught) { error.value = caught.message } finally { loading.value = false } })
</script>

<template>
  <section class="page-panel feedback-page">
    <header class="panel__header"><div><p class="eyebrow">HELP IMPROVE CSIT SHEET</p><h1>แจ้งปัญหาและข้อเสนอแนะ</h1><p>โปรดไม่ใส่รหัสผ่าน ข้อมูลลับ หรือข้อมูลส่วนบุคคลที่ไม่จำเป็น ระบบยังไม่รองรับไฟล์แนบ</p></div></header>
    <div class="feedback-layout">
      <form class="form feedback-form" @submit.prevent="submit">
        <label>ประเภท<select v-model="form.category"><option v-for="item in categories" :key="item[0]" :value="item[0]">{{ item[1] }}</option></select></label>
        <label>หัวข้อ<input v-model="form.subject" required minlength="5" maxlength="150" /></label>
        <label>รายละเอียด<textarea v-model="form.description" required minlength="10" maxlength="4000"></textarea></label>
        <label>หน้าที่เกี่ยวข้อง (ไม่บังคับ)<input v-model="form.relatedPath" maxlength="300" placeholder="/dashboard/search" /></label>
        <div class="form-grid"><label>ประเภทเอกสาร (ไม่บังคับ)<select v-model="form.relatedDocumentType"><option value="">ไม่ระบุ</option><option>Lecture</option><option>Sheet</option></select></label><label>รหัสเอกสาร<input v-model="form.relatedDocumentId" :required="Boolean(form.relatedDocumentType)" maxlength="100" /></label></div>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="success" class="form-success" role="status">{{ success }}</p>
        <button class="button button--primary" :disabled="busy">{{ busy ? 'กำลังส่ง…' : 'ส่งรายงาน' }}</button>
        <RouterLink to="/privacy" class="text-link">ข้อมูลความเป็นส่วนตัวที่เกี่ยวข้อง</RouterLink>
      </form>
      <section><h2>ประวัติของฉัน</h2><p v-if="loading">กำลังโหลด…</p><p v-else-if="!reports.length" class="material-meta">ยังไม่มีรายงาน</p>
        <div class="feedback-list"><button v-for="report in reports" :key="report.reference" type="button" class="feedback-card" @click="open(report.reference)"><strong>{{ report.subject }}</strong><span>{{ report.reference }} · {{ report.status }}</span></button></div>
        <article v-if="selected" class="feedback-detail"><p class="eyebrow">{{ selected.reference }}</p><h3>{{ selected.subject }}</h3><p>{{ selected.description }}</p><p><strong>สถานะ:</strong> {{ selected.status }}</p><ol class="feedback-events"><li v-for="(event, index) in selected.events" :key="`${event.createdAt}-${index}`"><strong>{{ event.type }}</strong><span v-if="event.publicMessage">{{ event.publicMessage }}</span><small>{{ event.createdAt }}</small></li></ol></article>
      </section>
    </div>
  </section>
</template>
