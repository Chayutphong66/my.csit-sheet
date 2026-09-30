<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { adminApi } from '@/services/admin.service'
import { downloadDocumentBlob, openDocumentBlob } from '@/services/document.service'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import UserIdentity from '@/components/shared/UserIdentity.vue'
import { documentTypeLabel, duplicateLabel } from '@/services/terminology'
import AdminRevisionPanel from './AdminRevisionPanel.vue'

const requests = ref([]), loading = ref(true), error = ref(''), selectedId = ref('')
const previewUrl = ref(''), previewLoading = ref(false), decisionBusy = ref(false)
const dialogMode = ref(''), rejectionReason = ref(''), decisionId = ref(''), feedback = ref('')
const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'ALL']
function initialReviewStatus() {
  const value = new URLSearchParams(window.location.search).get('status')?.toUpperCase()
  return REVIEW_STATUSES.includes(value) ? value : 'PENDING'
}
const selectedStatus = ref(initialReviewStatus()), revisionPanel = ref(null)
const revisionCounts = ref({ PENDING: 0, APPROVED: 0, REJECTED: 0, ALL: 0 })
let previewGeneration = 0, disposed = false

function reviewStatus(request) {
  if (request.status === 'COMPLETED') return 'APPROVED'
  if (['REJECTED', 'FAILED'].includes(request.status)) return 'REJECTED'
  return 'PENDING'
}
const filteredRequests = computed(() => requests.value.filter(item => selectedStatus.value === 'ALL' || reviewStatus(item) === selectedStatus.value))
const selected = computed(() => filteredRequests.value.find(item => item.id === selectedId.value) || null)
const requestCounts = computed(() => {
  const result = { PENDING: 0, APPROVED: 0, REJECTED: 0, ALL: requests.value.length }
  for (const request of requests.value) result[reviewStatus(request)]++
  return result
})
const totalCounts = computed(() => ({
  PENDING: requestCounts.value.PENDING + revisionCounts.value.PENDING,
  APPROVED: requestCounts.value.APPROVED + revisionCounts.value.APPROVED,
  REJECTED: requestCounts.value.REJECTED + revisionCounts.value.REJECTED,
  ALL: requestCounts.value.ALL + revisionCounts.value.ALL
}))
const duplicateCount = computed(() => requests.value.filter(item => reviewStatus(item) === 'PENDING' && item.duplicateStatus !== 'NONE').length)
const suggestionCount = computed(() => requests.value.filter(item => reviewStatus(item) === 'PENDING').reduce((total, item) => total + (item.teacherSuggestions?.filter(suggestion => suggestion.status === 'PENDING').length || 0), 0))
const emptyCopy = computed(() => ({
  PENDING: ['ไม่มีเอกสารใหม่ที่รอตรวจสอบ', 'ขณะนี้ไม่มีรายการอัปโหลดที่ต้องดำเนินการ'],
  APPROVED: ['ยังไม่มีเอกสารที่อนุมัติ', 'เอกสารที่อนุมัติแล้วจะยังคงอยู่ในประวัติ'],
  REJECTED: ['ยังไม่มีเอกสารที่ปฏิเสธ', 'เอกสารที่ปฏิเสธพร้อมเหตุผลจะแสดงที่นี่'],
  ALL: ['ยังไม่มีรายการตรวจสอบเอกสาร', 'รายการอัปโหลดและ revision จะปรากฏเมื่อมีการส่งเข้ามา']
}[selectedStatus.value]))

function clearPreview() {
  previewGeneration++
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}
async function loadData(preferredId = '') {
  loading.value = true; error.value = ''
  try {
    requests.value = await adminApi.adminUploadRequests()
    const next = filteredRequests.value.find(item => item.id === preferredId) || filteredRequests.value[0]
    if (next) await selectRequest(next)
    else { selectedId.value = ''; clearPreview() }
  } catch (caught) {
    requests.value = []; selectedId.value = ''; clearPreview()
    error.value = caught.message || 'ไม่สามารถโหลดรายการตรวจสอบได้'
  } finally { loading.value = false }
}
async function refreshAll() {
  await Promise.all([loadData(selectedId.value), revisionPanel.value?.load?.()])
}
async function changeStatus(value) {
  if (selectedStatus.value === value) return
  selectedStatus.value = value
  const params = new URLSearchParams(window.location.search)
  if (value === 'ALL') params.delete('status')
  else params.set('status', value)
  const query = params.toString()
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  feedback.value = ''; error.value = ''
  const next = filteredRequests.value[0]
  if (next) await selectRequest(next)
  else { selectedId.value = ''; clearPreview() }
}
async function selectRequest(request) {
  if (decisionBusy.value || dialogMode.value || disposed) return
  selectedId.value = request.id; clearPreview(); previewLoading.value = true; error.value = ''
  const generation = previewGeneration
  try {
    const blob = await adminApi.adminDownloadUploadRequestFile(request.id)
    if (!disposed && generation === previewGeneration) previewUrl.value = URL.createObjectURL(blob)
  } catch {
    if (!disposed && generation === previewGeneration) error.value = 'ไม่สามารถโหลดตัวอย่างไฟล์ได้ แต่ยังดูรายละเอียดรายการได้'
  } finally {
    if (!disposed && generation === previewGeneration) previewLoading.value = false
  }
}
async function openExisting(match, download = false) {
  try {
    const blob = match.publicDocumentId
      ? await adminApi.publicDocumentFile(match, download ? 'download' : 'view')
      : await adminApi.adminDownloadUploadRequestFile(match.id)
    if (download) downloadDocumentBlob(blob, match.fileName); else openDocumentBlob(blob)
  } catch { error.value = 'ไม่สามารถเปิดเอกสารเดิมได้' }
}
function openDecision(mode) {
  if (!selected.value || reviewStatus(selected.value) !== 'PENDING' || decisionBusy.value) return
  decisionId.value = selected.value.id; dialogMode.value = mode
  rejectionReason.value = mode === 'duplicate' ? 'เอกสารซ้ำกับรายการที่มีอยู่แล้ว' : ''
}
function closeDecision() { if (!decisionBusy.value) dialogMode.value = '' }
async function confirmDecision() {
  if (decisionBusy.value || !decisionId.value || !dialogMode.value) return
  if (dialogMode.value !== 'approve' && !rejectionReason.value.trim()) { error.value = 'กรุณาระบุเหตุผลก่อนยืนยัน'; return }
  decisionBusy.value = true; error.value = ''
  try {
    const mode = dialogMode.value
    if (mode === 'approve') await adminApi.approveUploadRequest(decisionId.value, {})
    else if (mode === 'duplicate') await adminApi.rejectDuplicateUploadRequest(decisionId.value, rejectionReason.value.trim())
    else await adminApi.rejectUploadRequest(decisionId.value, rejectionReason.value.trim())
    feedback.value = mode === 'approve' ? 'อนุมัติและเผยแพร่เอกสารแล้ว' : 'ปฏิเสธเอกสารและบันทึกเหตุผลแล้ว'
    dialogMode.value = ''; decisionBusy.value = false
    await loadData()
  } catch (caught) { error.value = caught.message }
  finally { decisionBusy.value = false }
}

onMounted(loadData)
onBeforeUnmount(() => { disposed = true; clearPreview() })
</script>

<template>
  <section class="page-panel admin-review-page">
    <header class="panel__header">
      <div><p class="eyebrow">Review queue</p><h1>คิวตรวจสอบเอกสาร</h1><p>ตรวจเอกสารใหม่และข้อเสนอการแก้ไขจากคิวเดียวกัน โดยประวัติที่อนุมัติหรือปฏิเสธจะไม่ถูกลบ</p></div>
      <button class="button button--ghost" type="button" :disabled="loading || decisionBusy || Boolean(dialogMode)" @click="refreshAll">รีเฟรชคิว</button>
    </header>

    <div class="request-tabs review-status-tabs" role="tablist" aria-label="กรองสถานะรายการตรวจสอบ">
      <button v-for="value in ['PENDING','APPROVED','REJECTED','ALL']" :key="value" class="tab-button" :class="{ 'tab-button--active': selectedStatus === value }" role="tab" :aria-selected="selectedStatus === value" @click="changeStatus(value)">{{ value === 'ALL' ? 'ทั้งหมด' : value }} ({{ totalCounts[value] }})</button>
    </div>
    <div class="queue-summary" aria-label="สรุปคิว">
      <article><span>รอตรวจสอบ</span><strong>{{ totalCounts.PENDING }}</strong></article>
      <article><span>อนุมัติแล้ว</span><strong>{{ totalCounts.APPROVED }}</strong></article>
      <article><span>ปฏิเสธแล้ว</span><strong>{{ totalCounts.REJECTED }}</strong></article>
      <article><span>ทั้งหมด</span><strong>{{ totalCounts.ALL }}</strong></article>
    </div>

    <AdminRevisionPanel ref="revisionPanel" :selected-status="selectedStatus" @counts="revisionCounts = $event" />

    <section class="legacy-review-section" data-review-kind="upload">
      <div class="section-heading"><div><p class="eyebrow">เอกสารใหม่</p><h2>รายการอัปโหลดเอกสาร</h2><p>ข้อเสนอผู้สอน {{ suggestionCount }} รายการ · สัญญาณเอกสารซ้ำ {{ duplicateCount }} รายการ</p></div><span class="count-pill">{{ filteredRequests.length }} รายการ</span></div>
      <p v-if="feedback" class="form-success" role="status">{{ feedback }}</p>
      <div v-if="loading" class="loading-state skeleton-list" aria-label="กำลังโหลดคิว"><div class="skeleton-line"></div><div class="skeleton-line"></div></div>
      <div v-else-if="error" class="error-state" role="alert"><p>{{ error }}</p><button class="button button--ghost" @click="loadData()">ลองอีกครั้ง</button></div>
      <div v-else-if="!filteredRequests.length" class="empty-state"><h3>{{ emptyCopy[0] }}</h3><p>{{ emptyCopy[1] }}</p></div>
      <div v-else class="admin-review-layout">
        <aside class="review-queue" aria-label="รายการอัปโหลด">
          <article v-for="request in filteredRequests" :key="request.id" class="review-queue-card" :class="{ 'is-selected': request.id === selectedId }" :data-review-status="reviewStatus(request)">
            <div class="badge-row"><span class="type-chip">เอกสารใหม่</span><StatusBadge :value="reviewStatus(request)" /><StatusBadge v-if="request.duplicateStatus !== 'NONE'" :value="request.duplicateStatus" duplicate /></div>
            <h3>{{ request.title }}</h3>
            <p>{{ request.courseName }} · {{ documentTypeLabel(request.documentType) }}</p>
            <p class="material-meta filename-wrap">{{ request.fileName }}</p>
            <p class="material-meta">ส่งโดย @{{ request.username }} · {{ new Date(request.createdAt).toLocaleDateString('th-TH') }}</p>
            <button class="button button--ghost" type="button" :aria-pressed="request.id === selectedId" :disabled="decisionBusy || Boolean(dialogMode)" @click="selectRequest(request)">{{ request.id === selectedId ? reviewStatus(request) === 'PENDING' ? 'กำลังตรวจรายการนี้' : 'กำลังดูรายละเอียด' : reviewStatus(request) === 'PENDING' ? 'ตรวจสอบ →' : 'ดูรายละเอียด' }}</button>
          </article>
        </aside>
        <section v-if="selected" class="approval-workspace" aria-label="รายละเอียดการตรวจสอบเอกสาร">
          <div class="approval-workspace__grid">
            <section class="preview-panel"><div class="section-heading"><div><p class="eyebrow">Document preview</p><h2>ตัวอย่างเอกสาร</h2></div><a v-if="previewUrl" class="text-link" :href="previewUrl" target="_blank" rel="noopener noreferrer">เปิดแท็บใหม่ ↗</a></div><div v-if="previewLoading" class="preview-placeholder">กำลังโหลดตัวอย่าง…</div><iframe v-else-if="previewUrl" :src="previewUrl" :title="`ตัวอย่าง ${selected.fileName}`"></iframe><div v-else class="preview-placeholder">ไม่มีตัวอย่างไฟล์</div></section>
            <section class="metadata-panel"><p class="eyebrow">Submission details</p><h2>{{ selected.title }}</h2><UserIdentity :username="selected.username" :display-name="selected.displayName" :avatar-url="selected.avatarUrl" :program="selected.contributorProgram" :cohort="selected.contributorCohort" :linked="false" /><dl class="metadata-list"><div><dt>สถานะ</dt><dd><StatusBadge :value="reviewStatus(selected)" /></dd></div><div><dt>ไฟล์</dt><dd class="wrap-anywhere">{{ selected.fileName }}</dd></div><div v-if="selected.description"><dt>คำอธิบาย</dt><dd class="wrap-anywhere">{{ selected.description }}</dd></div><div><dt>สาขา</dt><dd>{{ selected.programName || '—' }}</dd></div><div><dt>รายวิชา</dt><dd>{{ selected.courseName || '—' }}</dd></div><div><dt>ประเภท</dt><dd>{{ documentTypeLabel(selected.documentType) }}</dd></div><div><dt>ปี / ภาคเรียน</dt><dd>{{ selected.academicYear || '—' }} / {{ selected.semester || '—' }}</dd></div><div><dt>วันที่ส่ง</dt><dd>{{ new Date(selected.createdAt).toLocaleDateString('th-TH') }}</dd></div><div v-if="selected.decidedByUsername"><dt>ตรวจโดย</dt><dd>@{{ selected.decidedByUsername }}</dd></div><div v-if="selected.decidedAt"><dt>วันที่ตรวจ</dt><dd>{{ new Date(selected.decidedAt).toLocaleDateString('th-TH') }}</dd></div><div v-if="selected.rejectionReason"><dt>เหตุผล</dt><dd class="wrap-anywhere">{{ selected.rejectionReason }}</dd></div></dl></section>
          </div>
          <section v-if="selected.duplicateStatus !== 'NONE'" class="duplicate-comparison"><div class="section-heading"><div><p class="eyebrow">Duplicate review</p><h2>{{ duplicateLabel(selected.duplicateStatus) }}</h2></div><StatusBadge :value="selected.duplicateStatus" duplicate /></div><div class="comparison-grid"><article class="duplicate-card duplicate-card--new"><span class="type-chip">รายการใหม่</span><h3>{{ selected.title }}</h3><p>{{ selected.fileName }}</p><small>{{ selected.courseName }} · {{ selected.academicYear }}/{{ selected.semester }} · @{{ selected.username }}</small></article><article v-for="match in selected.duplicateMatches" :key="`${match.source}-${match.id}`" class="duplicate-card"><span class="type-chip">รายการที่พบ</span><h3>{{ match.title }}</h3><p>{{ match.fileName }}</p><small>{{ duplicateLabel(match.matchType) }} · Binary {{ match.binaryMatch ? 'ตรงกัน' : 'ต่างกัน' }} · Content {{ match.contentMatch ? 'ตรงกัน' : 'ต่างกัน' }}</small><div v-if="match.publicDocumentId || match.source === 'REQUEST'" class="table-actions"><button class="button button--small button--ghost" @click="openExisting(match)">ดูรายการเดิม</button><button class="button button--small button--ghost" @click="openExisting(match, true)">ดาวน์โหลด</button></div></article></div></section>
          <footer v-if="reviewStatus(selected) === 'PENDING'" class="approval-actions"><div><strong>พร้อมตัดสินใจหรือยัง?</strong><p>ตรวจไฟล์ ข้อมูลรายวิชา และสัญญาณเอกสารซ้ำให้ครบก่อน</p></div><div class="table-actions"><button class="button button--danger" type="button" :disabled="decisionBusy" @click="openDecision('reject')">ปฏิเสธ</button><button v-if="selected.duplicateStatus !== 'NONE'" class="button button--danger-soft" type="button" :disabled="decisionBusy" @click="openDecision('duplicate')">ปฏิเสธว่าเอกสารซ้ำ</button><button class="button button--primary" type="button" :disabled="decisionBusy" @click="openDecision('approve')">อนุมัติและเผยแพร่</button></div></footer>
        </section>
      </div>
    </section>

    <ConfirmDialog :open="Boolean(dialogMode)" :title="dialogMode === 'approve' ? 'อนุมัติและเผยแพร่เอกสารนี้?' : dialogMode === 'duplicate' ? 'ปฏิเสธเป็นเอกสารซ้ำ?' : 'ปฏิเสธเอกสารนี้?'" :description="`ตรวจสอบการตัดสินใจสำหรับ ${selected?.title || ''} ของ @${selected?.username || ''}`" :confirm-label="dialogMode === 'approve' ? 'ยืนยันการเผยแพร่' : dialogMode === 'duplicate' ? 'ยืนยันว่าเอกสารซ้ำ' : 'ยืนยันการปฏิเสธ'" :danger="dialogMode !== 'approve'" :busy="decisionBusy" @cancel="closeDecision" @confirm="confirmDecision"><label v-if="dialogMode !== 'approve'" class="dialog-field">เหตุผล<textarea v-model="rejectionReason" rows="4" maxlength="500" placeholder="อธิบายเหตุผลให้ผู้ส่งเข้าใจ"></textarea></label></ConfirmDialog>
  </section>
</template>
