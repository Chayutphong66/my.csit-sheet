<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { contributorApi } from '@/services/contributor.service'
import { documentApi, downloadDocumentBlob, openDocumentBlob } from '@/services/document.service'
import ProfileSidebar from './ProfileSidebar.vue'
import ProfileOverview from './ProfileOverview.vue'
import ProfileDocumentList from './ProfileDocumentList.vue'
import ProfileUploadRequests from './ProfileUploadRequests.vue'
import './profile.css'

const props = defineProps({ own: Boolean }); const auth = useAuthStore(); const route = useRoute()
const username = computed(() => props.own ? auth.user?.username : route.params.username)
const profile = ref(null); const loading = ref(true); const error = ref(''); const actionError = ref(''); const busy = ref(''); const saving = ref(false)
let generation = 0
const active = computed(() => ['documents', 'requests', 'stars', 'contributions'].includes(route.query?.tab) ? route.query.tab : 'overview')
const tabs = computed(() => [
  { key: 'overview', label: 'Overview' },
  { key: 'documents', label: 'Documents', count: profile.value?.documents.length },
  { key: 'contributions', label: 'Contributions', count: profile.value?.isOwner ? profile.value.revisions.length : undefined },
  { key: 'requests', label: 'Upload Requests', count: profile.value?.isOwner ? profile.value.requests.length : undefined },
  { key: 'stars', label: 'Stars', count: profile.value?.stars.length }
])
async function load() {
  const current = ++generation; loading.value = true; error.value = ''
  try {
    const result = await contributorApi.profile(username.value)
    if (current === generation) profile.value = { ...result, documents: result.documents || [], stars: result.stars || [], requests: result.requests || [], revisions: result.revisions || [], activity: result.activity || [], badges: result.badges || [] }
  } catch (caught) { if (current === generation) error.value = caught.message }
  finally { if (current === generation) loading.value = false }
}
async function star(document) {
  if (busy.value) return
  const current = generation; const previous = Boolean(document.starredByMe); const count = document.starCount || 0
  let saved = false; busy.value = `${document.documentType}:${document.id}`; actionError.value = ''; document.starredByMe = !previous; document.starCount = count + (previous ? -1 : 1)
  try { await contributorApi.star(document, !previous); saved = true; const result = await contributorApi.profile(username.value); if (current === generation) profile.value = { ...result, documents: result.documents || [], stars: result.stars || [], requests: result.requests || [], revisions: result.revisions || [], activity: result.activity || [], badges: result.badges || [] } }
  catch (caught) { if (current === generation) { if (!saved) { document.starredByMe = previous; document.starCount = count } actionError.value = caught.message } }
  finally { busy.value = '' }
}
async function act(document, kind) {
  if (busy.value) return
  const current = generation; busy.value = `${document.documentType}:${document.id}`; actionError.value = ''
  try {
    if (kind === 'view') openDocumentBlob((await documentApi.view(document)).blob)
    else if (kind === 'download') downloadDocumentBlob((await documentApi.download(document)).blob, document.fileName)
    else { const state = await documentApi.helpful(document, !document.helpfulByMe); document.helpfulByMe = state.helpful; document.helpfulCount = state.helpfulCount }
    const result = await contributorApi.profile(username.value); if (current === generation) profile.value = result
  } catch (caught) { if (current === generation) actionError.value = caught.message }
  finally { busy.value = '' }
}
async function follow(value) { saving.value = true; actionError.value = ''; try { await contributorApi.follow(profile.value.username, value); await load() } catch (caught) { actionError.value = caught.message } finally { saving.value = false } }
watch(username, load, { immediate: true }); onBeforeUnmount(() => { generation++ })
</script>

<template>
  <section class="page-panel document-profile">
    <div v-if="loading" class="loading-state skeleton-list"><div class="skeleton-line" /><div class="skeleton-line" /></div>
    <div v-else-if="error" class="error-state" role="alert"><h1>เปิดโปรไฟล์ไม่ได้</h1><p>{{ error }}</p><button class="button button--ghost" @click="load">ลองอีกครั้ง</button></div>
    <div v-else-if="profile" class="document-profile__layout">
      <ProfileSidebar :profile="profile" :saving="saving" @follow="follow" />
      <div class="document-profile__content">
        <nav class="document-profile__tabs" aria-label="Profile navigation"><RouterLink v-for="tab in tabs" :key="tab.key" :to="{ path: route.path, query: tab.key === 'overview' ? {} : { tab: tab.key } }" :class="{ 'document-profile__tab--active': active === tab.key }" :aria-current="active === tab.key ? 'page' : undefined">{{ tab.label }}<span v-if="tab.count !== undefined" class="count-pill">{{ tab.count }}</span></RouterLink></nav>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
        <ProfileOverview v-if="active === 'overview'" :profile="profile" :busy="busy" @star="star" @view="act($event, 'view')" />
        <ProfileDocumentList v-else-if="active === 'documents' || active === 'stars'" :key="active" :documents="active === 'stars' ? profile.stars : profile.documents" :starred="active === 'stars'" :busy="busy" @star="star" @view="act($event, 'view')" @download="act($event, 'download')" @helpful="act($event, 'helpful')" />
        <ProfileUploadRequests v-else :requests="active === 'contributions' ? [] : profile.requests" :revisions="active === 'contributions' ? profile.revisions : []" :is-owner="profile.isOwner" />
      </div>
    </div>
  </section>
</template>
