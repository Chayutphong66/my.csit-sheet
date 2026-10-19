<script setup>
import { ref } from 'vue'
import { acknowledgePrivacyNotice, readPrivacyAcknowledgement } from '@/services/privacyNotice'

const visible = ref(!readPrivacyAcknowledgement())
function acknowledge() {
  acknowledgePrivacyNotice()
  visible.value = false
}
</script>

<template>
  <aside v-if="visible" class="privacy-notice" role="region" aria-labelledby="privacy-notice-title">
    <div>
      <strong id="privacy-notice-title">ข้อมูลการใช้บริการและความเป็นส่วนตัว</strong>
      <p>ระบบใช้ข้อมูลบัญชี เอกสาร กิจกรรมการใช้งาน และข้อมูลที่จำเป็นต่อการยืนยันตัวตน เพื่อให้บริการค้นหา แบ่งปัน ตรวจสอบเอกสาร และรักษาความปลอดภัย การกด “รับทราบ” ใช้เพื่อปิดข้อความนี้และไม่ถือเป็นการให้ความยินยอมทางกฎหมาย</p>
      <RouterLink to="/privacy" class="text-link">อ่านรายละเอียดความเป็นส่วนตัว</RouterLink>
    </div>
    <button type="button" class="button button--primary" @click="acknowledge">รับทราบ</button>
  </aside>
</template>
