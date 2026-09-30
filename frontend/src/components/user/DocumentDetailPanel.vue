<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { contributorApi } from '@/services/contributor.service'
import { documentApi, downloadDocumentBlob, openDocumentBlob } from '@/services/document.service'
import DocumentImpactActions from './DocumentImpactActions.vue'
import RevisionForm from './RevisionForm.vue'
import VersionHistory from './VersionHistory.vue'
import UserIdentity from '@/components/shared/UserIdentity.vue'

const route = useRoute(); const document = ref(null); const versions = ref([]); const loading = ref(true); const error = ref(''); const message = ref(''); const busy = ref(''); const showRevision = ref(route.query.revision === '1' || route.hash === '#submit-revision')
async function load() {
  loading.value = true; error.value = ''
  try {
    const shell = { id: route.params.id, documentType: route.params.type }
    const [detail, history] = await Promise.all([documentApi.detail(shell), documentApi.versions(shell)])
    document.value = detail; versions.value = history.versions || []
  } catch (caught) { error.value = caught.message }
  finally { loading.value = false }
}
onMounted(load)
async function currentAction(kind) { busy.value = kind; try { const result = await documentApi[kind](document.value); if (kind === 'view') openDocumentBlob(result.blob); else downloadDocumentBlob(result.blob, document.value.fileName); await load() } catch (caught) { error.value = caught.message } finally { busy.value = '' } }
async function versionAction(kind, version) { busy.value = version.id; try { const result = await documentApi[kind === 'view' ? 'viewVersion' : 'downloadVersion'](version); if (kind === 'view') openDocumentBlob(result.blob); else downloadDocumentBlob(result.blob, version.originalFileName) } catch (caught) { error.value = caught.message } finally { busy.value = '' } }
async function helpful() { busy.value = 'helpful'; try { const state = await documentApi.helpful(document.value, !document.value.helpfulByMe); Object.assign(document.value, { helpfulByMe: state.helpful, helpfulCount: state.helpfulCount }) } catch (caught) { error.value = caught.message } finally { busy.value = '' } }
async function star() { busy.value = 'star'; try { const state = await contributorApi.star(document.value, !document.value.starredByMe); Object.assign(document.value, state) } catch (caught) { error.value = caught.message } finally { busy.value = '' } }
function submitted(revision) { showRevision.value = false; message.value = `ส่งการแก้ไขแล้ว สถานะ ${revision.status} เวอร์ชันปัจจุบันยังคงเป็น v${document.value.currentVersionNumber}` }
</script>

<template>
  <section class="page-panel document-detail-page">
    <div v-if="loading" class="loading-state">กำลังโหลดเอกสาร…</div>
    <div v-else-if="error && !document" class="error-state"><h1>เปิดเอกสารไม่ได้</h1><p>{{ error }}</p><button class="button button--ghost" @click="load">ลองอีกครั้ง</button></div>
    <template v-else-if="document">
      <p v-if="message" class="form-success" role="status">{{ message }}</p><p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <header class="document-detail-hero"><div><div class="badge-row"><span class="type-chip">{{ document.documentType }}</span><span class="current-version-badge">CURRENT v{{ document.currentVersionNumber }}</span></div><h1>{{ document.title }}</h1><p>{{ document.courseCode }} · {{ document.courseName }} · ปี {{ document.academicYear }} / ภาคเรียน {{ document.semester }}</p><p v-if="document.description">{{ document.description }}</p></div><button class="button button--primary" @click="showRevision = !showRevision">เสนอการแก้ไข</button></header>
      <section class="current-version-card"><div><p class="eyebrow">Current Version</p><h2>เวอร์ชันปัจจุบัน v{{ document.currentVersionNumber }}</h2><p>{{ document.currentVersion?.changeSummary || 'Initial published version' }}</p><UserIdentity :username="document.currentContributorUsername" :display-name="document.currentContributorDisplayName" :avatar-url="document.currentContributorAvatarUrl" compact /></div><div class="table-actions"><button class="button button--ghost" :disabled="Boolean(busy)" @click="star">{{ document.starredByMe ? '★ บันทึกแล้ว' : '☆ Star' }}</button><button class="button button--ghost" :disabled="Boolean(busy)" @click="currentAction('view')">เปิดดู</button><button class="button button--primary" :disabled="Boolean(busy)" @click="currentAction('download')">ดาวน์โหลด</button></div></section>
      <RevisionForm v-if="showRevision" :document="document" @submitted="submitted" @cancel="showRevision = false" />
      <DocumentImpactActions :document="document" :busy="Boolean(busy)" @view="currentAction('view')" @download="currentAction('download')" @helpful="helpful" />
      <VersionHistory :versions="versions" :current-version-id="document.currentVersionId" :busy="busy" @view="versionAction('view', $event)" @download="versionAction('download', $event)" />
    </template>
  </section>
</template>
