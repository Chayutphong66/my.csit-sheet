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
      <strong id="privacy-notice-title">การใช้ข้อมูลที่จำเป็นต่อการให้บริการ</strong>
      <p>ระบบใช้ข้อมูลบัญชี เอกสาร และกิจกรรมที่จำเป็นต่อการเข้าสู่ระบบ การแบ่งปัน และการดูแลความปลอดภัย โดยไม่พบระบบโฆษณาหรือ analytics แบบเลือกได้ในโค้ดปัจจุบัน</p>
      <RouterLink to="/privacy" class="text-link">อ่านรายละเอียดความเป็นส่วนตัว</RouterLink>
    </div>
    <button type="button" class="button button--primary" @click="acknowledge">รับทราบ</button>
  </aside>
</template>
