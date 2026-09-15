<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { adminApi } from '@/services/admin.service'
import { downloadDocumentBlob, openDocumentBlob } from '@/services/document.service'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import UserIdentity from '@/components/shared/UserIdentity.vue'
import { documentTypeLabel, duplicateLabel } from '@/services/terminology'

const requests = ref([])
const loading = ref(true)
const error = ref('')
const selectedId = ref('')
const previewUrl = ref('')
const previewLoading = ref(false)
const decisionBusy = ref(false)
const dialogMode = ref('')
const rejectionReason = ref('')
const pending = computed(() => requests.value.filter((item) => item.status === 'PENDING'))
const selected = computed(() => pending.value.find((item) => item.id === selectedId.value) || null)
const duplicateCount = computed(() => pending.value.filter((item) => item.duplicateStatus !== 'NONE').length)

function clearPreview() { if (previewUrl.value) URL.revokeObjectURL(previewUrl.value); previewUrl.value = '' }
async function loadData(preferredId = '') {
  loading.value = true; error.value = ''
  try {
    requests.value = await adminApi.adminUploadRequests()
    const next = pending.value.find((item) => item.id === preferredId) || pending.value[0]
    if (next) await selectRequest(next)
    else { selectedId.value = ''; clearPreview() }
  } catch { error.value = 'โหลดคิวตรวจสอบไม่สำเร็จ กรุณาลองใหม่' } finally { loading.value = false }
}
async function selectRequest(request) {
  selectedId.value = request.id; clearPreview(); previewLoading.value = true; error.value = ''
  try { previewUrl.value = URL.createObjectURL(await adminApi.adminDownloadUploadRequestFile(request.id)) }
  catch { error.value = 'ไม่สามารถโหลดตัวอย่างไฟล์ได้ แต่ยังตรวจข้อมูลและดำเนินการต่อได้' }
  finally { previewLoading.value = false }
}
async function openExisting(match, download = false) {
  try { const blob = await adminApi.publicDocumentFile(match, download ? 'download' : 'view'); if (download) downloadDocumentBlob(blob, match.fileName); else openDocumentBlob(blob) }
  catch { error.value = 'ไม่สามารถเปิดเอกสารเดิมได้' }
}
function openDecision(mode) { dialogMode.value = mode; rejectionReason.value = mode === 'duplicate' ? 'เอกสารซ้ำกับรายการที่มีอยู่แล้ว' : '' }
function closeDecision() { if (!decisionBusy.value) dialogMode.value = '' }
async function approve() { decisionBusy.value = true; error.value = ''; try { await adminApi.approveUploadRequest(selected.value.id, {}); await loadData() } catch (caught) { error.value = caught.message } finally { decisionBusy.value = false } }
async function confirmDecision() {
  if (!rejectionReason.value.trim()) { error.value = 'กรุณาระบุเหตุผลก่อนยืนยัน'; return }
  decisionBusy.value = true; error.value = ''
  try {
    if (dialogMode.value === 'duplicate') await adminApi.rejectDuplicateUploadRequest(selected.value.id, rejectionReason.value.trim())
    else await adminApi.rejectUploadRequest(selected.value.id, rejectionReason.value.trim())
    dialogMode.value = ''; await loadData()
  } catch (caught) { error.value = caught.message } finally { decisionBusy.value = false }
}
onMounted(loadData)
onBeforeUnmount(clearPreview)
</script>

<template>
  <section class="page-panel admin-review-page">
    <header class="panel__header"><div><p class="eyebrow">Review queue</p><h1>คิวตรวจสอบเอกสาร</h1><p>เลือกงานหนึ่งรายการ ตรวจเนื้อหาและข้อมูลประกอบ แล้วจึงตัดสินใจ</p></div><button class="button button--ghost" type="button" :disabled="loading" @click="loadData(selectedId)">รีเฟรชคิว</button></header>
    <div class="queue-summary" aria-label="สรุปคิว"><article><span>ต้องดำเนินการ</span><strong>{{ pending.length }}</strong></article><article><span>มีสัญญาณซ้ำ</span><strong>{{ duplicateCount }}</strong></article><article><span>ตรวจแล้วทั้งหมด</span><strong>{{ requests.length - pending.length }}</strong></article></div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div v-if="loading" class="loading-state skeleton-list" aria-label="กำลังโหลดคิว"><div class="skeleton-line"></div><div class="skeleton-line"></div></div>
    <div v-else-if="!pending.length" class="empty-state"><span class="empty-state__icon" aria-hidden="true">✓</span><h2>ตรวจครบแล้ว</h2><p>ยังไม่มีเอกสารใหม่ที่ต้องดำเนินการ</p></div>
    <div v-else class="admin-review-layout">
      <aside class="review-queue" aria-label="รายการรอตรวจสอบ">
        <article v-for="request in pending" :key="request.id" class="review-queue-card" :class="{ 'is-selected': request.id === selectedId }">
          <div><StatusBadge :value="request.status" /><StatusBadge v-if="request.duplicateStatus !== 'NONE'" :value="request.duplicateStatus" duplicate /></div>
          <h2>{{ request.title }}</h2><p>{{ request.courseName }} · {{ documentTypeLabel(request.documentType) }}</p><p class="material-meta">{{ request.fileName }}</p>
          <button class="button button--ghost" type="button" :aria-pressed="request.id === selectedId" @click="selectRequest(request)">{{ request.id === selectedId ? 'กำลังตรวจรายการนี้' : 'ตรวจสอบ →' }}</button>
        </article>
      </aside>
      <section v-if="selected" class="approval-workspace" aria-label="พื้นที่ตรวจสอบเอกสาร">
        <div class="approval-workspace__grid">
          <section class="preview-panel"><div class="section-heading"><div><p class="eyebrow">Document preview</p><h2>ตัวอย่างเอกสาร</h2></div><a v-if="previewUrl" class="text-link" :href="previewUrl" target="_blank" rel="noopener noreferrer">เปิดแท็บใหม่ ↗</a></div><div v-if="previewLoading" class="preview-placeholder">กำลังโหลดตัวอย่าง…</div><iframe v-else-if="previewUrl" :src="previewUrl" :title="`ตัวอย่าง ${selected.fileName}`"></iframe><div v-else class="preview-placeholder">ไม่มีตัวอย่างไฟล์</div></section>
          <section class="metadata-panel"><p class="eyebrow">Submission details</p><h2>{{ selected.title }}</h2><UserIdentity :username="selected.username" :display-name="selected.displayName" :avatar-url="selected.avatarUrl" :linked="false" /><dl class="metadata-list"><div><dt>ไฟล์</dt><dd>{{ selected.fileName }}</dd></div><div><dt>รายวิชา</dt><dd>{{ selected.courseName || '—' }}</dd></div><div><dt>ประเภท</dt><dd>{{ documentTypeLabel(selected.documentType) }}</dd></div><div><dt>ปี / ภาคเรียน</dt><dd>{{ selected.academicYear || '—' }} / {{ selected.semester || '—' }}</dd></div><div><dt>ผู้สอน</dt><dd>{{ selected.instructorName || '—' }}</dd></div><div><dt>วันที่ส่ง</dt><dd>{{ selected.createdAt || '—' }}</dd></div></dl></section>
        </div>
        <section v-if="selected.duplicateStatus !== 'NONE'" class="duplicate-comparison"><div class="section-heading"><div><p class="eyebrow">Duplicate review</p><h2>{{ duplicateLabel(selected.duplicateStatus) }}</h2></div><StatusBadge :value="selected.duplicateStatus" duplicate /></div><div class="comparison-grid"><article class="duplicate-card duplicate-card--new"><span class="type-chip">รายการใหม่</span><h3>{{ selected.title }}</h3><p>{{ selected.fileName }}</p><small>{{ selected.courseName }} · {{ selected.academicYear }}/{{ selected.semester }} · @{{ selected.username }}</small></article><article v-for="match in selected.duplicateMatches" :key="`${match.source}-${match.id}`" class="duplicate-card"><span class="type-chip">รายการที่พบ</span><h3>{{ match.title }}</h3><p>{{ match.fileName }}</p><small>{{ duplicateLabel(match.matchType) }} · Binary {{ match.binaryMatch ? 'ตรงกัน' : 'ต่างกัน' }} · Content {{ match.contentMatch ? 'ตรงกัน' : 'ต่างกัน' }}</small><div v-if="match.publicDocumentId" class="table-actions"><button class="button button--small button--ghost" @click="openExisting(match)">ดูรายการเดิม</button><button class="button button--small button--ghost" @click="openExisting(match, true)">ดาวน์โหลด</button></div></article></div></section>
        <footer class="approval-actions"><div><strong>พร้อมตัดสินใจหรือยัง?</strong><p>ตรวจไฟล์ ข้อมูลรายวิชา และสัญญาณเอกสารซ้ำให้ครบก่อน</p></div><div class="table-actions"><button class="button button--danger" type="button" :disabled="decisionBusy" @click="openDecision('reject')">ปฏิเสธ</button><button v-if="selected.duplicateStatus !== 'NONE'" class="button button--danger-soft" type="button" :disabled="decisionBusy" @click="openDecision('duplicate')">ปฏิเสธว่าเอกสารซ้ำ</button><button class="button button--primary" type="button" :disabled="decisionBusy" @click="approve">อนุมัติและเผยแพร่</button></div></footer>
      </section>
    </div>
    <ConfirmDialog :open="Boolean(dialogMode)" :title="dialogMode === 'duplicate' ? 'ปฏิเสธเป็นเอกสารซ้ำ?' : 'ปฏิเสธเอกสารนี้?'" :description="`การตัดสินใจนี้จะส่งเหตุผลกลับไปยัง @${selected?.username || ''}`" :confirm-label="dialogMode === 'duplicate' ? 'ยืนยันว่าเอกสารซ้ำ' : 'ยืนยันการปฏิเสธ'" danger :busy="decisionBusy" @cancel="closeDecision" @confirm="confirmDecision"><label class="dialog-field">เหตุผล<textarea v-model="rejectionReason" rows="4" maxlength="500" placeholder="อธิบายให้ผู้ส่งแก้ไขหรือเข้าใจการตัดสินใจ"></textarea></label></ConfirmDialog>
  </section>
</template>
