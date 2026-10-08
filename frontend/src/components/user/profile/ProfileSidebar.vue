<script setup>
import { ref } from 'vue'
import { programName } from '@/services/communityIdentity'
import { contributorApi } from '@/services/contributor.service'
const props = defineProps({ profile: { type: Object, required: true }, saving: Boolean })
defineEmits(['follow'])
const connections = ref(null); const connectionKind = ref('')
async function showConnections(kind) { connectionKind.value = kind; connections.value = await contributorApi[kind](props.profile.username) }
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
    <p v-if="profile.bio">{{ profile.bio }}</p>
    <RouterLink v-if="profile.isOwner" class="button button--ghost" to="/dashboard/settings">Edit profile</RouterLink>
    <button v-else class="button" :class="profile.followedByMe ? 'button--ghost' : 'button--primary'" :disabled="saving" @click="$emit('follow', !profile.followedByMe)">{{ profile.followedByMe ? 'Following' : 'Follow' }}</button>
    <p class="profile-follow-counts"><button class="text-link" @click="showConnections('followers')"><strong>{{ profile.followersCount || 0 }}</strong> followers</button> · <button class="text-link" @click="showConnections('following')"><strong>{{ profile.followingCount || 0 }}</strong> following</button></p>
    <section v-if="connections" class="profile-connections"><div class="section-heading"><strong>{{ connectionKind }}</strong><button class="icon-button" aria-label="Close" @click="connections=null">×</button></div><p v-if="!connections.length" class="material-meta">No {{ connectionKind }} yet.</p><RouterLink v-for="person in connections" :key="person.username" :to="`/dashboard/users/${person.username}`">{{ person.displayName }} · @{{ person.username }}</RouterLink></section>
    <p class="level-pill">{{ profile.contributorLevel }} · {{ profile.contributionScore }} คะแนน</p>
    <div class="badge-list"><span v-for="badge in profile.badges" :key="badge" class="recognition-badge">★ {{ badge }}</span></div>
    <p class="material-meta">{{ profile.lectureCount || 0 }} Lecture · {{ profile.sheetCount || 0 }} Sheet</p>
    <p class="material-meta">{{ profile.acceptedRevisions || 0 }} revisions ที่ได้รับอนุมัติ · {{ profile.contributions || 0 }} contributions</p>
    <p class="material-meta">{{ profile.totalViews || 0 }} ครั้งที่ดู · {{ profile.totalDownloads || 0 }} ดาวน์โหลด · {{ profile.helpful || 0 }} มีประโยชน์</p>
  </aside>
</template>
