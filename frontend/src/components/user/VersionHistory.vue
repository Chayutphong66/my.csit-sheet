<script setup>
import UserIdentity from '@/components/shared/UserIdentity.vue'
defineProps({ versions: { type: Array, default: () => [] }, currentVersionId: { type: String, default: '' }, busy: { type: String, default: '' }, canRestore: Boolean })
defineEmits(['view', 'download', 'restore'])
const revisionLabels = { INITIAL: 'เผยแพร่ครั้งแรก', ADD_CONTENT: 'เพิ่มเนื้อหา', CORRECT_CONTENT: 'แก้ไขเนื้อหา', REMOVE_INCORRECT: 'แก้ข้อมูลไม่ถูกต้อง', UPDATE_DOCUMENT: 'อัปเดตเอกสาร', NEW_ACADEMIC_YEAR: 'อัปเดตปีการศึกษา', OTHER: 'การแก้ไขอื่น ๆ', RESTORE: 'กู้คืนเวอร์ชัน' }
</script>

<template>
  <section class="version-history">
    <div class="section-heading"><div><p class="eyebrow">Immutable history</p><h2>ประวัติเวอร์ชัน</h2></div><span class="count-pill">{{ versions.length }} เวอร์ชัน</span></div>
    <div v-if="!versions.length" class="empty-state empty-state--compact"><h3>ยังไม่มีประวัติเวอร์ชัน</h3></div>
    <ol v-else class="version-timeline">
      <li v-for="version in versions" :key="version.id" :class="{ 'is-current': version.id === currentVersionId }">
        <div class="version-heading"><strong>v{{ version.versionNumber }}</strong><span v-if="version.id === currentVersionId" class="current-version-badge">CURRENT</span><span class="type-chip">{{ revisionLabels[version.revisionType] || version.revisionType }}</span></div>
        <p>{{ version.changeSummary }}</p>
        <UserIdentity :username="version.contributorUsername" :display-name="version.contributorDisplayName" :avatar-url="version.contributorAvatarUrl" compact />
        <p class="material-meta">{{ new Date(version.createdAt).toLocaleDateString('th-TH') }} · {{ version.originalFileName }}<span v-if="version.sourceVersionNumber"> · จาก v{{ version.sourceVersionNumber }}</span></p>
        <div class="table-actions"><button class="button button--ghost button--small" :disabled="Boolean(busy)" @click="$emit('view', version)">เปิดดู</button><button class="button button--ghost button--small" :disabled="Boolean(busy)" @click="$emit('download', version)">ดาวน์โหลด</button><button v-if="canRestore && version.id !== currentVersionId" class="button button--danger-soft button--small" :disabled="Boolean(busy)" @click="$emit('restore', version)">กู้คืนเวอร์ชันนี้</button></div>
      </li>
    </ol>
  </section>
</template>
