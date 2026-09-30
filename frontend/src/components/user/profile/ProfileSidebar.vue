<script setup>
import { ref, watch } from 'vue'
import { PROGRAM_OPTIONS, cohortOptions, programName } from '@/services/communityIdentity'
const props = defineProps({ profile: { type: Object, required: true }, saving: Boolean })
defineEmits(['save'])
const editing = ref(false)
const form = ref({ displayName: props.profile.displayName, program: props.profile.program || '', cohort: props.profile.cohort || '' })
const cohorts = cohortOptions()
watch(() => props.profile, value => { form.value = { displayName: value.displayName, program: value.program || '', cohort: value.cohort || '' }; editing.value = false })
</script>

<template>
  <aside class="document-profile__sidebar">
    <img v-if="profile.avatarUrl" class="document-profile__avatar" :src="profile.avatarUrl" alt="" />
    <div v-else class="document-profile__avatar document-profile__avatar--fallback" aria-hidden="true">{{ (profile.displayName || profile.username).slice(0, 1) }}</div>
    <h1>{{ profile.displayName || profile.username }}</h1><p class="material-meta">@{{ profile.username }}</p>
    <p class="material-meta community-identity">
      <span>{{ profile.program ? `${programName(profile.program)} (${profile.program})` : 'ยังไม่ได้ระบุสาขา' }}</span>
      <span>{{ profile.cohort ? `รุ่น ${profile.cohort}` : 'ยังไม่ได้ระบุรุ่น' }}</span>
    </p>
    <button v-if="profile.isOwner && !editing" class="button button--ghost" @click="editing = true">Edit profile</button>
    <form v-if="editing" class="form-grid" @submit.prevent="$emit('save', form)">
      <label>Display name<input v-model="form.displayName" required maxlength="100" /></label>
      <label>สาขา<select v-model="form.program"><option value="">ยังไม่ได้ระบุสาขา</option><option v-for="program in PROGRAM_OPTIONS" :key="program.value" :value="program.value">{{ program.label }}</option></select></label>
      <label>รุ่น<select v-model="form.cohort"><option value="">ยังไม่ได้ระบุรุ่น</option><option v-for="cohort in cohorts" :key="cohort" :value="cohort">รุ่น {{ cohort }}</option></select></label>
      <div class="table-actions"><button class="button button--primary" :disabled="saving">Save</button><button class="button button--ghost" type="button" :disabled="saving" @click="editing = false">Cancel</button></div>
    </form>
    <p class="level-pill">{{ profile.contributorLevel }} · {{ profile.contributionScore }} คะแนน</p>
    <div class="badge-list"><span v-for="badge in profile.badges" :key="badge" class="recognition-badge">★ {{ badge }}</span></div>
    <p class="material-meta">{{ profile.lectureCount || 0 }} Lecture · {{ profile.sheetCount || 0 }} Sheet</p>
    <p class="material-meta">{{ profile.acceptedRevisions || 0 }} revisions ที่ได้รับอนุมัติ · {{ profile.contributions || 0 }} contributions</p>
    <p class="material-meta">{{ profile.totalViews || 0 }} ครั้งที่ดู · {{ profile.totalDownloads || 0 }} ดาวน์โหลด · {{ profile.helpful || 0 }} มีประโยชน์</p>
    <section v-if="profile.privateAccount" class="private-account-card" aria-label="ข้อมูลบัญชีส่วนตัว"><div><span>อีเมลส่วนตัว</span><strong>{{ profile.privateAccount.email }}</strong></div><div><span>สิทธิ์การใช้งาน</span><strong>{{ profile.privateAccount.role }}</strong></div><p>ข้อมูลส่วนนี้เห็นได้เฉพาะคุณ</p></section>
  </aside>
</template>
