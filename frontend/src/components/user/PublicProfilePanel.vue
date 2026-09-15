<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { contributorApi } from '@/services/contributor.service'
import { documentApi, downloadDocumentBlob, openDocumentBlob } from '@/services/document.service'
import UserIdentity from '@/components/shared/UserIdentity.vue'
import DocumentImpactActions from '@/components/user/DocumentImpactActions.vue'
import { documentTypeLabel } from '@/services/terminology'

const route = useRoute()
const profile = ref(null)
const loading = ref(true)
const error = ref('')
const busy = ref('')

async function load() {
  loading.value = true; error.value = ''; profile.value = null
  try { profile.value = await contributorApi.profile(route.params.username) }
  catch (caught) { error.value = caught.message || 'ไม่สามารถโหลดโปรไฟล์นี้ได้' }
  finally { loading.value = false }
}
async function view(document) { busy.value = document.id; try { openDocumentBlob((await documentApi.view(document)).blob); await load() } catch { error.value = 'ไม่สามารถเปิดเอกสารได้' } finally { busy.value = '' } }
async function download(document) { busy.value = document.id; try { downloadDocumentBlob((await documentApi.download(document)).blob, document.fileName); await load() } catch { error.value = 'ไม่สามารถดาวน์โหลดได้' } finally { busy.value = '' } }
async function helpful(document) { busy.value = document.id; try { const state = await documentApi.helpful(document, !document.helpfulByMe); document.helpfulByMe = state.helpful; document.helpfulCount = state.helpfulCount } catch (caught) { error.value = caught.message } finally { busy.value = '' } }
onMounted(load)
watch(() => route.params.username, load)
</script>

<template>
  <section class="page-panel public-profile">
    <div v-if="loading" class="loading-state skeleton-list" aria-label="กำลังโหลดโปรไฟล์"><div class="skeleton-line"></div><div class="skeleton-line"></div></div>
    <div v-else-if="error" class="error-state" role="alert"><h1>เปิดโปรไฟล์ไม่ได้</h1><p>{{ error }}</p><button class="button button--ghost" @click="load">ลองอีกครั้ง</button></div>
    <template v-else-if="profile">
      <header class="profile-hero">
        <div><p class="eyebrow">โปรไฟล์ผู้แบ่งปัน</p><UserIdentity :username="profile.username" :display-name="profile.displayName" :avatar-url="profile.avatarUrl" :linked="false" /><p class="profile-hero__level">{{ profile.contributorLevel }} · {{ profile.contributionScore }} คะแนน</p></div>
        <RouterLink class="button button--ghost" to="/dashboard/search">ค้นหาผู้แบ่งปันคนอื่น</RouterLink>
      </header>
      <div class="stats-grid" aria-label="สรุปผลงานสาธารณะ">
        <article class="stat-card"><span>เผยแพร่แล้ว</span><strong>{{ profile.publishedCount }}</strong><p>เอกสาร</p></article>
        <article class="stat-card stat-card--lavender"><span>การสอน / ชีท</span><strong>{{ profile.lectureCount }} / {{ profile.sheetCount }}</strong><p>แยกตามประเภท</p></article>
        <article class="stat-card stat-card--yellow"><span>การเข้าถึง</span><strong>{{ profile.totalDownloads }}</strong><p>ดาวน์โหลด</p></article>
        <article class="stat-card stat-card--green"><span>ชุมชนบอกว่า</span><strong>{{ profile.helpful }}</strong><p>มีประโยชน์</p></article>
      </div>
      <section class="content-section">
        <div class="section-heading"><div><p class="eyebrow">Recognition</p><h2>เหรียญรางวัล</h2></div></div>
        <div v-if="profile.badges.length" class="badge-list"><span v-for="badge in profile.badges" :key="badge" class="recognition-badge">★ {{ badge }}</span></div>
        <p v-else class="material-meta">รางวัลจะปรากฏเมื่อผลงานสร้างประโยชน์ให้ชุมชน</p>
      </section>
      <section class="content-section">
        <div class="section-heading"><div><p class="eyebrow">Public contributions</p><h2>ผลงานล่าสุด</h2></div><span class="count-pill">{{ profile.documents.length }} รายการ</span></div>
        <div v-if="profile.documents.length" class="request-list">
          <article v-for="document in profile.documents" :key="`${document.documentType}-${document.id}`" class="request-card document-card">
            <div class="request-card__main"><span class="type-chip">{{ documentTypeLabel(document.documentType) }}</span><h3>{{ document.title }}</h3><p>{{ document.courseCode }} · {{ document.courseName }} · ปี {{ document.academicYear }} · เทอม {{ document.semester }}</p></div>
            <DocumentImpactActions :document="document" :busy="busy === document.id" @view="view(document)" @download="download(document)" @helpful="helpful(document)" />
          </article>
        </div>
        <div v-else class="empty-state"><h3>ยังไม่มีผลงานที่เผยแพร่</h3><p>หน้านี้แสดงเฉพาะเอกสารที่ผ่านการตรวจสอบแล้ว</p></div>
      </section>
    </template>
  </section>
</template>
