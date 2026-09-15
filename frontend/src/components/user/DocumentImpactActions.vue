<script setup>
import UserIdentity from '@/components/shared/UserIdentity.vue'
import { UI_TERMS } from '@/services/terminology'
defineProps({ document: { type: Object, required: true }, busy: { type: Boolean, default: false } })
defineEmits(['view', 'download', 'helpful'])
</script>

<template>
  <div class="document-impact">
    <div class="document-impact__contributor">
      <span>แบ่งปันโดย</span>
      <UserIdentity :username="document.uploaderUsername" :display-name="document.uploaderDisplayName" :avatar-url="document.uploaderAvatarUrl" compact />
    </div>
    <p class="document-impact__counts">
      <span>{{ document.viewCount || 0 }} ครั้งที่ดู</span>
      <span>{{ document.downloadCount || 0 }} ดาวน์โหลด</span>
      <span>{{ document.helpfulCount || 0 }} มีประโยชน์</span>
    </p>
    <div class="table-actions">
      <button class="button button--ghost" type="button" :disabled="busy" @click="$emit('view')">{{ UI_TERMS.view }}</button>
      <button class="button button--primary" type="button" :disabled="busy" @click="$emit('download')">{{ UI_TERMS.download }}</button>
      <button class="button" :class="document.helpfulByMe ? 'button--selected' : 'button--ghost'" type="button" :disabled="busy" :aria-pressed="Boolean(document.helpfulByMe)" @click="$emit('helpful')">{{ document.helpfulByMe ? '✓ มีประโยชน์แล้ว' : UI_TERMS.helpful }}</button>
    </div>
  </div>
</template>
