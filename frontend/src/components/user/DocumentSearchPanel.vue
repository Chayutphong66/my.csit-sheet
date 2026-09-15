<script setup>
import { ref } from 'vue'
import { documentApi, downloadDocumentBlob, openDocumentBlob } from '@/services/document.service'
import { contributorApi } from '@/services/contributor.service'
import DocumentImpactActions from '@/components/user/DocumentImpactActions.vue'
import ContributorCard from '@/components/user/ContributorCard.vue'
import { documentTypeLabel } from '@/services/terminology'

const query = ref('')
const documents = ref([])
const contributors = ref([])
const loading = ref(false)
const error = ref('')
const searched = ref(false)
const busy = ref('')

async function search() {
  const term = query.value.trim()
  if (!term) { error.value = 'พิมพ์ชื่อเอกสาร รายวิชา หรือผู้แบ่งปันก่อนค้นหา'; return }
  loading.value = true; error.value = ''
  try {
    const [documentResult, contributorResult] = await Promise.all([documentApi.search(term), contributorApi.search(term)])
    documents.value = documentResult.documents
    contributors.value = contributorResult.contributors
    searched.value = true
  } catch { error.value = 'ค้นหาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' } finally { loading.value = false }
}
async function view(document) { busy.value = document.id; try { openDocumentBlob((await documentApi.view(document)).blob); await search() } catch { error.value = 'ไม่สามารถเปิดเอกสารได้' } finally { busy.value = '' } }
async function download(document) { busy.value = document.id; try { downloadDocumentBlob((await documentApi.download(document)).blob, document.fileName); await search() } catch { error.value = 'ไม่สามารถดาวน์โหลดได้' } finally { busy.value = '' } }
async function helpful(document) { busy.value = document.id; try { const state = await documentApi.helpful(document, !document.helpfulByMe); document.helpfulByMe = state.helpful; document.helpfulCount = state.helpfulCount } catch (caught) { error.value = caught.message } finally { busy.value = '' } }
</script>

<template>
  <section class="page-panel search-page">
    <div class="panel__header"><div><p class="eyebrow">Discover knowledge & people</p><h1>ค้นหาใน CSIT Sheet</h1><p>ค้นหาเอกสาร รายวิชา ชื่อไฟล์ หรือผู้แบ่งปันได้จากช่องเดียว</p></div></div>
    <form class="search-hero" role="search" @submit.prevent="search">
      <label class="sr-only" for="unified-search">คำค้นหา</label>
      <input id="unified-search" v-model="query" type="search" maxlength="100" autocomplete="off" placeholder="เช่น Database, ปี 2568 หรือ @username" />
      <button class="button button--primary" :disabled="loading">{{ loading ? 'กำลังค้นหา…' : 'ค้นหา' }}</button>
    </form>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div v-if="loading" class="loading-state skeleton-list" aria-label="กำลังค้นหา"><div class="skeleton-line"></div><div class="skeleton-line"></div></div>
    <template v-else-if="searched">
      <section class="search-section">
        <div class="section-heading"><h2>ผู้แบ่งปัน</h2><span class="count-pill">{{ contributors.length }} คน</span></div>
        <div v-if="contributors.length" class="contributor-grid"><ContributorCard v-for="person in contributors" :key="person.username" :contributor="person" /></div>
        <div v-else class="empty-state empty-state--compact"><h3>ไม่พบผู้แบ่งปัน</h3><p>ลองค้นด้วย username หรือชื่อที่แสดง</p></div>
      </section>
      <section class="search-section">
        <div class="section-heading"><h2>เอกสาร</h2><span class="count-pill">{{ documents.length }} รายการ</span></div>
        <div v-if="documents.length" class="request-list">
          <article v-for="document in documents" :key="`${document.documentType}-${document.id}`" class="request-card document-card">
            <div class="request-card__main"><span class="type-chip">{{ documentTypeLabel(document.documentType) }}</span><h3>{{ document.title }}</h3><p>{{ document.courseCode }} · {{ document.courseName }} · ปี {{ document.academicYear }} · เทอม {{ document.semester }}</p><RouterLink class="text-link" :to="`/dashboard/courses/${document.courseId}/years/${document.academicYear}`">ดูรายวิชา →</RouterLink></div>
            <DocumentImpactActions :document="document" :busy="busy === document.id" @view="view(document)" @download="download(document)" @helpful="helpful(document)" />
          </article>
        </div>
        <div v-else class="empty-state empty-state--compact"><h3>ไม่พบเอกสาร</h3><p>ลองใช้ชื่อรายวิชา รหัสวิชา ชื่อไฟล์ หรือปีการศึกษา</p></div>
      </section>
    </template>
    <div v-else class="empty-state"><span class="empty-state__icon" aria-hidden="true">⌕</span><h2>เริ่มสำรวจคลังความรู้</h2><p>ผลลัพธ์จะแยกเอกสารและผู้แบ่งปันให้เห็นชัดเจน</p></div>
  </section>
</template>
