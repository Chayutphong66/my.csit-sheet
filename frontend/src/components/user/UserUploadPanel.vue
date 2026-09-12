<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import DocumentUploadForm from '@/components/user/DocumentUploadForm.vue'
import UserRequestsPanel from '@/components/user/UserRequestsPanel.vue'

const route = useRoute()
const activeTab = ref(route.query.request ? 'history' : 'material')
const historyKey = ref(0)
function onUploaded() { historyKey.value += 1; activeTab.value = 'history' }
</script>
<template><section class="page-panel"><div class="panel__header"><div><p class="eyebrow">Contribute</p><h1>Upload</h1><p>Submit new learning material and track all of your uploads in one place.</p></div></div><div class="request-tabs" role="tablist" aria-label="Upload sections"><button class="tab-button" :class="{ 'tab-button--active': activeTab === 'material' }" role="tab" :aria-selected="activeTab === 'material'" @click="activeTab = 'material'">Upload Material</button><button class="tab-button" :class="{ 'tab-button--active': activeTab === 'history' }" role="tab" :aria-selected="activeTab === 'history'" @click="activeTab = 'history'">My Uploads</button></div><div v-if="activeTab === 'material'" class="profile-section"><DocumentUploadForm @uploaded="onUploaded" /></div><UserRequestsPanel v-else :key="historyKey" embedded :selected-id="String(route.query.request || '')" /></section></template>
