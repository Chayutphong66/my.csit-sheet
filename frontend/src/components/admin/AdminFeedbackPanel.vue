<script setup>
import { onMounted, reactive, ref } from 'vue'
import { feedbackApi } from '@/services/feedback.service'

const filters = reactive({ search: '', status: '', category: '', sort: 'newest', page: 1, limit: 20 })
const result = ref({ items: [], total: 0 }); const selected = ref(null)
const review = reactive({ status: '', internalNote: '', publicMessage: '' })
const loading = ref(false); const busy = ref(false); const error = ref('')
async function load() { loading.value = true; error.value = ''; try { result.value = await feedbackApi.adminList(filters) } catch (caught) { error.value = caught.message } finally { loading.value = false } }
async function open(reference) { selected.value = await feedbackApi.adminDetail(reference); Object.assign(review, { status: '', internalNote: '', publicMessage: '' }) }
async function save() {
  busy.value = true; error.value = ''
  try {
    selected.value = await feedbackApi.adminUpdate(selected.value.reference, { ...review, expectedVersion: selected.value.version })
    Object.assign(review, { status: '', internalNote: '', publicMessage: '' }); await load()
  } catch (caught) {
    error.value = caught.message
    if (/updated by another reviewer/i.test(caught.message)) await open(selected.value.reference)
  } finally { busy.value = false }
}
onMounted(load)
</script>

<template>
  <section class="page-panel feedback-admin">
    <header class="panel__header"><div><p class="eyebrow">ADMIN · FEEDBACK</p><h1>จัดการรายงานผู้ใช้</h1><p>Internal note มองเห็นเฉพาะผู้ดูแล ส่วนข้อความตอบกลับจะแสดงแก่ผู้รายงาน</p></div><span class="count-pill">{{ result.total }} รายการ</span></header>
    <form class="feedback-filters" @submit.prevent="filters.page=1; load()"><input v-model="filters.search" aria-label="ค้นหารายงาน" placeholder="เลขอ้างอิงหรือหัวข้อ" /><select v-model="filters.status" aria-label="สถานะ"><option value="">ทุกสถานะ</option><option v-for="status in ['OPEN','IN_REVIEW','RESOLVED','CLOSED','DUPLICATE']" :key="status">{{ status }}</option></select><select v-model="filters.category" aria-label="ประเภท"><option value="">ทุกประเภท</option><option v-for="category in ['BUG','FEEDBACK','FEATURE_REQUEST','INCORRECT_CONTENT']" :key="category">{{ category }}</option></select><select v-model="filters.sort" aria-label="เรียงลำดับ"><option value="newest">ใหม่สุด</option><option value="oldest">เก่าสุด</option><option value="updated">อัปเดตล่าสุด</option></select><button class="button button--ghost">ค้นหา</button></form>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div class="admin-feedback-layout"><div class="feedback-list"><p v-if="loading">กำลังโหลด…</p><button v-for="report in result.items" :key="report.reference" type="button" class="feedback-card" :class="{ 'is-selected': selected?.reference === report.reference }" @click="open(report.reference)"><strong>{{ report.subject }}</strong><span>{{ report.reference }} · {{ report.category }} · {{ report.status }}</span></button><div class="table-actions"><button type="button" class="button button--small button--ghost" :disabled="filters.page === 1" @click="filters.page--; load()">ก่อนหน้า</button><button type="button" class="button button--small button--ghost" :disabled="filters.page * filters.limit >= result.total" @click="filters.page++; load()">ถัดไป</button></div></div>
      <article v-if="selected" class="feedback-detail"><p class="eyebrow">{{ selected.reference }}</p><h2>{{ selected.subject }}</h2><p>{{ selected.description }}</p><p><strong>ผู้รายงาน:</strong> {{ selected.reporter?.displayName || selected.reporter?.username || 'บัญชีถูกลบ' }}</p><p><strong>สถานะ:</strong> {{ selected.status }} · version {{ selected.version }}</p><p v-if="selected.relatedPath"><strong>หน้าที่เกี่ยวข้อง:</strong> {{ selected.relatedPath }}</p>
        <ol class="feedback-events"><li v-for="(event,index) in selected.events" :key="`${event.createdAt}-${index}`"><strong>{{ event.type }}</strong><span v-if="event.internalNote">Internal: {{ event.internalNote }}</span><span v-if="event.publicMessage">Public: {{ event.publicMessage }}</span><small>{{ event.actorUsername || 'deleted account' }} · {{ event.createdAt }}</small></li></ol>
        <form class="form" @submit.prevent="save"><div class="dialog-field"><label for="feedback-review-status">เปลี่ยนสถานะ</label><select id="feedback-review-status" v-model="review.status"><option value="">ไม่เปลี่ยน</option><option v-for="status in ['IN_REVIEW','RESOLVED','CLOSED','DUPLICATE']" :key="status">{{ status }}</option></select></div><label>Internal note<textarea v-model="review.internalNote" maxlength="2000"></textarea></label><label>ข้อความถึงผู้รายงาน<textarea v-model="review.publicMessage" maxlength="1000"></textarea></label><button class="button button--primary" :disabled="busy">บันทึกการตรวจสอบ</button></form>
      </article><div v-else class="placeholder-box">เลือกรายงานเพื่อดูรายละเอียด</div></div>
  </section>
</template>
