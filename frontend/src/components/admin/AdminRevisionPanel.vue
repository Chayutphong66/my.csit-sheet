<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { adminApi } from '@/services/admin.service'
import { documentApi, downloadDocumentBlob, openDocumentBlob } from '@/services/document.service'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import UserIdentity from '@/components/shared/UserIdentity.vue'
import VersionHistory from '@/components/user/VersionHistory.vue'

const props = defineProps({ selectedStatus: { type: String, default: 'PENDING' } })
const emit = defineEmits(['counts'])
const revisions = ref([]), selectedId = ref(''), loading = ref(true), busy = ref('')
const error = ref(''), loadError = ref(''), message = ref(''), reason = ref(''), versions = ref([])

const filtered = computed(() => revisions.value.filter(item => props.selectedStatus === 'ALL' || item.status === props.selectedStatus))
const selected = computed(() => filtered.value.find(item => item.id === selectedId.value) || null)
const counts = computed(() => ({
  PENDING: revisions.value.filter(item => item.status === 'PENDING').length,
  APPROVED: revisions.value.filter(item => item.status === 'APPROVED').length,
  REJECTED: revisions.value.filter(item => item.status === 'REJECTED').length,
  ALL: revisions.value.length
}))
const emptyCopy = computed(() => ({
  PENDING: ['ไม่มีข้อเสนอการแก้ไขที่รอตรวจสอบ', 'ขณะนี้ไม่มี revision ที่ต้องดำเนินการ'],
  APPROVED: ['ยังไม่มีข้อเสนอการแก้ไขที่อนุมัติ', 'Revision ที่อนุมัติแล้วจะยังคงอยู่ในประวัติ'],
  REJECTED: ['ยังไม่มีข้อเสนอการแก้ไขที่ปฏิเสธ', 'Revision ที่ปฏิเสธพร้อมเหตุผลจะแสดงที่นี่'],
  ALL: ['ยังไม่มีประวัติข้อเสนอการแก้ไข', 'เมื่อมีผู้เสนอ revision รายการจะปรากฏที่นี่']
}[props.selectedStatus]))

function publishCounts() { emit('counts', counts.value) }
async function loadVersions() {
  versions.value = selected.value
    ? (await documentApi.versions({ id: selected.value.documentId, documentType: selected.value.documentType })).versions || []
    : []
}
async function syncSelection(preferred = '') {
  const next = filtered.value.find(item => item.id === preferred) || filtered.value[0]
  selectedId.value = next?.id || ''
  reason.value = ''
  await loadVersions()
}
async function load(preferred = '') {
  loading.value = true; error.value = ''; loadError.value = ''
  try {
    revisions.value = (await adminApi.revisions('')).revisions || []
    publishCounts()
    try { await syncSelection(preferred) }
    catch (caught) { versions.value = []; error.value = caught.message || 'ไม่สามารถโหลดประวัติเวอร์ชันได้' }
  } catch (caught) {
    revisions.value = []; selectedId.value = ''; versions.value = []
    publishCounts()
    loadError.value = caught.message || 'ไม่สามารถโหลดข้อเสนอการแก้ไขได้'
  } finally { loading.value = false }
}
async function select(item) {
  selectedId.value = item.id; error.value = ''; reason.value = ''
  try { await loadVersions() } catch (caught) { error.value = caught.message }
}
async function preview() {
  if (!selected.value) return
  busy.value = 'preview'
  try { openDocumentBlob(await adminApi.revisionFile(selected.value.id)) }
  catch (caught) { error.value = caught.message }
  finally { busy.value = '' }
}
async function approve() {
  if (!selected.value || busy.value) return
  const id = selected.value.id
  busy.value = 'approve'; error.value = ''
  try {
    const result = await adminApi.approveRevision(id)
    message.value = `อนุมัติและเผยแพร่เป็น v${result.versionNumber} แล้ว`
    await load()
  } catch (caught) { error.value = caught.message }
  finally { busy.value = '' }
}
async function reject() {
  if (!selected.value || busy.value) return
  if (!reason.value.trim()) { error.value = 'กรุณาระบุเหตุผลการปฏิเสธ'; return }
  const id = selected.value.id
  busy.value = 'reject'; error.value = ''
  try {
    await adminApi.rejectRevision(id, reason.value.trim())
    message.value = 'ปฏิเสธข้อเสนอการแก้ไขและบันทึกเหตุผลแล้ว'
    await load()
  } catch (caught) { error.value = caught.message }
  finally { busy.value = '' }
}
async function versionAction(kind, version) {
  busy.value = version.id
  try {
    const result = await documentApi[kind === 'view' ? 'viewVersion' : 'downloadVersion'](version)
    if (kind === 'view') openDocumentBlob(result.blob)
    else downloadDocumentBlob(result.blob, version.originalFileName)
  } catch (caught) { error.value = caught.message }
  finally { busy.value = '' }
}
async function restore(version) {
  busy.value = version.id; error.value = ''
  try {
    const result = await adminApi.restoreVersion({ id: selected.value.documentId, documentType: selected.value.documentType }, version.id)
    message.value = `สร้าง v${result.versionNumber} จาก v${version.versionNumber} แล้ว`
    await loadVersions()
  } catch (caught) { error.value = caught.message }
  finally { busy.value = '' }
}

watch(() => props.selectedStatus, () => { syncSelection().catch(caught => { error.value = caught.message }) })
onMounted(load)
defineExpose({ load })
</script>

<template>
  <section class="admin-revision-panel" data-review-kind="revision">
    <div class="section-heading">
      <div><p class="eyebrow">การแก้ไขเอกสาร</p><h2>ข้อเสนอการแก้ไขเอกสาร</h2><p>ตรวจไฟล์และสรุปการเปลี่ยนแปลงก่อนสร้างเวอร์ชันถัดไป</p></div>
      <span class="count-pill">{{ filtered.length }} รายการ</span>
    </div>
    <p v-if="message" class="form-success" role="status">{{ message }}</p><p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div v-if="loading" class="loading-state">กำลังโหลดข้อเสนอ…</div>
    <div v-else-if="loadError" class="error-state" role="alert"><p>{{ loadError }}</p><button class="button button--ghost" @click="load()">ลองอีกครั้ง</button></div>
    <div v-else-if="!filtered.length" class="empty-state empty-state--compact"><h3>{{ emptyCopy[0] }}</h3><p>{{ emptyCopy[1] }}</p></div>
    <div v-else class="revision-review-layout">
      <aside class="review-queue" aria-label="รายการข้อเสนอการแก้ไข">
        <article v-for="item in filtered" :key="item.id" class="review-queue-card" :class="{ 'is-selected': selectedId === item.id }" :data-review-status="item.status">
          <div class="badge-row"><span class="type-chip">การแก้ไขเอกสาร</span><StatusBadge :value="item.status" /></div>
          <h3>{{ item.documentTitle }}</h3>
          <p>{{ item.courseCode }} · v{{ item.currentVersionNumber || 1 }} → {{ item.status === 'APPROVED' ? `v${item.versionNumber}` : 'ข้อเสนอ' }}</p>
          <p class="material-meta filename-wrap">{{ item.originalFileName }}</p>
          <button class="button button--ghost button--small" @click="select(item)">{{ item.status === 'PENDING' ? 'ตรวจสอบเอกสาร' : 'ดูรายละเอียด' }}</button>
        </article>
      </aside>
      <section v-if="selected" class="revision-review-detail">
        <div class="section-heading"><div><p class="eyebrow">{{ selected.documentType }} · {{ selected.academicYear }}/{{ selected.semester }}</p><h3>{{ selected.documentTitle }}</h3></div><StatusBadge :value="selected.status" /></div>
        <UserIdentity :username="selected.contributorUsername" :display-name="selected.contributorDisplayName" :avatar-url="selected.contributorAvatarUrl" :program="selected.contributorProgram" :cohort="selected.contributorCohort" :linked="false" />
        <dl class="metadata-list">
          <div><dt>ประเภทการแก้ไข</dt><dd>{{ selected.revisionType }}</dd></div>
          <div><dt>สรุปการเปลี่ยนแปลง</dt><dd class="wrap-anywhere">{{ selected.changeSummary }}</dd></div>
          <div><dt>ไฟล์</dt><dd class="wrap-anywhere">{{ selected.originalFileName }}</dd></div>
          <div><dt>ขนาด</dt><dd>{{ (selected.fileSize / 1024).toFixed(1) }} KB</dd></div>
          <div><dt>วันที่ส่ง</dt><dd>{{ new Date(selected.createdAt).toLocaleDateString('th-TH') }}</dd></div>
          <div v-if="selected.status === 'APPROVED'"><dt>เผยแพร่เป็น</dt><dd>v{{ selected.versionNumber }}</dd></div>
          <div v-if="selected.reviewerUsername"><dt>ตรวจโดย</dt><dd>@{{ selected.reviewerUsername }}</dd></div>
          <div v-if="selected.reviewedAt"><dt>วันที่ตรวจ</dt><dd>{{ new Date(selected.reviewedAt).toLocaleDateString('th-TH') }}</dd></div>
          <div v-if="selected.reviewNote"><dt>เหตุผล</dt><dd class="wrap-anywhere">{{ selected.reviewNote }}</dd></div>
        </dl>
        <button class="button button--ghost" :disabled="Boolean(busy)" @click="preview">เปิดไฟล์ข้อเสนอ</button>
        <div v-if="selected.status === 'PENDING'" class="revision-decision">
          <label>เหตุผลกรณีปฏิเสธ<textarea v-model="reason" maxlength="500" rows="3" /></label>
          <div class="table-actions"><button class="button button--danger" :disabled="Boolean(busy)" @click="reject">ปฏิเสธ</button><button class="button button--primary" :disabled="Boolean(busy)" @click="approve">อนุมัติเป็นเวอร์ชันถัดไป</button></div>
        </div>
        <VersionHistory :versions="versions" :current-version-id="versions.find(item => item.versionNumber === Math.max(...versions.map(value => value.versionNumber)))?.id" :busy="busy" can-restore @view="versionAction('view', $event)" @download="versionAction('download', $event)" @restore="restore" />
      </section>
    </div>
  </section>
</template>
