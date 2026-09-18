<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import DocumentUploadForm from '@/components/user/DocumentUploadForm.vue'
import UserRequestsPanel from '@/components/user/UserRequestsPanel.vue'

const route = useRoute()
const activeTab = ref(route.query.request ? 'history' : 'material')
const historyKey = ref(0)
function onUploaded() { historyKey.value += 1; activeTab.value = 'history' }
function switchTab(event) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()
  activeTab.value = event.key === 'Home' ? 'material' : event.key === 'End' ? 'history' : activeTab.value === 'material' ? 'history' : 'material'
  document.getElementById(`upload-tab-${activeTab.value}`)?.focus()
}
</script>
<template>
  <section class="page-panel">
    <div class="panel__header"><div><p class="eyebrow">Share what you know</p><h1>อัปโหลดและติดตาม</h1><p>แบ่งปันเอกสารใหม่และดูสถานะทั้งหมดได้ในที่เดียว</p></div></div>
    <div class="request-tabs" role="tablist" aria-label="ส่วนอัปโหลด" @keydown="switchTab">
      <button id="upload-tab-material" type="button" class="tab-button" :class="{ 'tab-button--active': activeTab === 'material' }" role="tab" aria-controls="upload-panel-material" :tabindex="activeTab === 'material' ? 0 : -1" :aria-selected="activeTab === 'material'" @click="activeTab = 'material'">อัปโหลดเอกสาร</button>
      <button id="upload-tab-history" type="button" class="tab-button" :class="{ 'tab-button--active': activeTab === 'history' }" role="tab" aria-controls="upload-panel-history" :tabindex="activeTab === 'history' ? 0 : -1" :aria-selected="activeTab === 'history'" @click="activeTab = 'history'">การอัปโหลดของฉัน</button>
    </div>
    <div v-if="activeTab === 'material'" id="upload-panel-material" role="tabpanel" aria-labelledby="upload-tab-material" class="profile-section"><DocumentUploadForm @uploaded="onUploaded" /></div>
    <div v-else id="upload-panel-history" role="tabpanel" aria-labelledby="upload-tab-history"><UserRequestsPanel :key="historyKey" embedded :selected-id="String(route.query.request || '')" /></div>
  </section>
</template>
