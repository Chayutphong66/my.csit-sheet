<script setup>
import { onMounted, ref } from 'vue'
import SheetTable from '@/components/sheet/SheetTable.vue'
import { sheetApi } from '@/services/api'

const pendingSheets = ref([])
const loading = ref(true)

async function loadData() {
  loading.value = true
  pendingSheets.value = await sheetApi.pending()
  loading.value = false
}

async function approve(id) {
  await sheetApi.approve(id)
  await loadData()
}

async function reject(id) {
  const reason = window.prompt('เหตุผลในการปฏิเสธ') || 'ไม่ผ่านเกณฑ์การตรวจสอบ'
  await sheetApi.reject(id, reason)
  await loadData()
}

onMounted(loadData)
</script>

<template>
  <section class="page-panel">
    <div class="panel__header">
      <div>
        <p class="eyebrow">Admin</p>
        <h1>Request</h1>
        <p>หน้าเริ่มต้นสำหรับตรวจคำขอที่รออนุมัติ</p>
      </div>
    </div>
    <p v-if="loading">กำลังโหลดข้อมูล...</p>
    <SheetTable v-else :sheets="pendingSheets" admin @approve="approve" @reject="reject" />
  </section>
</template>
