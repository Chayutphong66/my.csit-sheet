<script setup>
import { onMounted, ref } from 'vue'
import SheetTable from '@/components/sheet/SheetTable.vue'
import { sheetApi } from '@/services/api'

const sheets = ref([])
const loading = ref(true)

onMounted(async () => {
  sheets.value = await sheetApi.mine()
  loading.value = false
})
</script>

<template>
  <section class="page-panel">
    <div class="panel__header">
      <div>
        <p class="eyebrow">User</p>
        <h1>SHEET</h1>
        <p>รายการชีทของผู้ใช้และสถานะการตรวจสอบ</p>
      </div>
    </div>
    <p v-if="loading">กำลังโหลดข้อมูล...</p>
    <SheetTable v-else :sheets="sheets" />
  </section>
</template>
