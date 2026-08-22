<script setup>
defineProps({
  sheets: { type: Array, required: true },
  admin: { type: Boolean, default: false }
})

defineEmits(['approve', 'reject'])
</script>

<template>
  <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>ชื่อชีท</th>
          <th>วิชา</th>
          <th v-if="admin">ผู้ส่ง</th>
          <th>สถานะ</th>
          <th>วันที่ส่ง</th>
          <th v-if="!admin">ดาวน์โหลด</th>
          <th v-if="admin">จัดการ</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="sheet in sheets" :key="sheet.id">
          <td>{{ sheet.title }}</td>
          <td>{{ sheet.subject }}</td>
          <td v-if="admin">{{ sheet.uploaderUsername }}</td>
          <td>
            <span class="status" :class="`status--${sheet.status.toLowerCase()}`">
              {{ sheet.status }}
            </span>
          </td>
          <td>{{ sheet.createdAt }}</td>
          <td v-if="!admin">{{ sheet.downloadCount }}</td>
          <td v-if="admin" class="table-actions">
            <button class="button button--small button--primary" @click="$emit('approve', sheet.id)">อนุมัติ</button>
            <button class="button button--small button--danger" @click="$emit('reject', sheet.id)">ปฏิเสธ</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
