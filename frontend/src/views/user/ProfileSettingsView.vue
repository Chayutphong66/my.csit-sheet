<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { contributorApi } from '@/services/contributor.service'
import { PROGRAM_OPTIONS, cohortOptions, programName } from '@/services/communityIdentity'
import AvatarEditor from '@/components/user/profile/AvatarEditor.vue'

const settingsSections = [
  { id: 'public-profile', label: 'โปรไฟล์' },
  { id: 'account', label: 'บัญชี' },
  { id: 'privacy', label: 'ความเป็นส่วนตัว' },
  { id: 'notifications', label: 'การแจ้งเตือน' },
  { id: 'password', label: 'ความปลอดภัย' }
]
const sectionIds = new Set(settingsSections.map(section => section.id))
const route = useRoute()
const auth = useAuthStore()
const data = ref(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const success = ref('')
const avatarMenu = ref(false)
const cropFile = ref(null)
const uploadInput = ref(null)
const profile = reactive({ displayName: '', bio: '' })
const privacy = reactive({ profilePublic: true, showProgram: true, showCohort: true })
const notifications = reactive({ newFollower: true, followedDocuments: true, documentActivity: true, activityEmail: false })
const change = reactive({ category: 'PROGRAM', requestedValue: '', reason: '' })

const activeSection = computed(() => {
  const requested = route.hash.replace(/^#/, '')
  return sectionIds.has(requested) ? requested : 'public-profile'
})
const nextDate = computed(() => data.value?.profile.nextDisplayNameChangeAt && new Date(data.value.profile.nextDisplayNameChangeAt))
const nameLocked = computed(() => nextDate.value && nextDate.value > new Date())

async function load() {
  data.value = await contributorApi.settings()
  Object.assign(profile, data.value.profile)
  Object.assign(privacy, data.value.profile)
  Object.assign(notifications, data.value.notifications)
}

async function run(action) {
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    await action()
    success.value = 'บันทึกเรียบร้อย'
    await auth.refresh()
    await load()
  } catch (caught) {
    error.value = caught.message
  } finally {
    busy.value = false
  }
}

const saveProfile = () => run(() => contributorApi.edit(profile))
const saveOptions = () => run(() => contributorApi.saveSettings({ privacy, notifications }))
async function requestChange() {
  if (!window.confirm('ยืนยันการส่งคำขอให้ผู้ดูแลตรวจสอบ?')) return
  await run(() => contributorApi.requestChange(change))
  change.requestedValue = ''
  change.reason = ''
}
function selectAvatar(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 1024 * 1024) {
    error.value = 'Please upload a picture smaller than 1 MB.'
    return
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    error.value = 'Please upload a valid PNG, JPEG, or WebP image.'
    return
  }
  cropFile.value = file
  avatarMenu.value = false
}
const saveAvatar = fileData => run(async () => {
  await contributorApi.uploadAvatar(fileData)
  cropFile.value = null
})
const removeAvatar = () => run(async () => {
  await contributorApi.removeAvatar()
  avatarMenu.value = false
})
function avatarError(message) {
  error.value = message
  cropFile.value = null
}

onMounted(async () => {
  try {
    await load()
  } catch (caught) {
    error.value = caught.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="page-panel settings-page">
    <nav class="settings-nav" aria-label="หมวดการตั้งค่า">
      <h1>การตั้งค่า</h1>
      <div class="settings-nav__links">
        <RouterLink
          v-for="section in settingsSections"
          :key="section.id"
          :to="{ name: 'profile-settings', hash: `#${section.id}` }"
          :class="{ 'is-active': activeSection === section.id }"
          :aria-current="activeSection === section.id ? 'page' : undefined"
        >{{ section.label }}</RouterLink>
      </div>
    </nav>

    <main class="settings-content">
      <p v-if="loading" class="loading-state" role="status">กำลังโหลดการตั้งค่า…</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-if="success" class="form-success" role="status">{{ success }}</p>

      <template v-if="data">
        <section v-show="activeSection === 'public-profile'" id="public-profile" class="settings-section">
          <h2>โปรไฟล์สาธารณะ</h2>
          <div class="avatar-setting">
            <img v-if="data.profile.avatarUrl" :src="data.profile.avatarUrl" alt="รูปโปรไฟล์ปัจจุบัน" />
            <div v-else class="document-profile__avatar--fallback">{{ profile.displayName.slice(0, 1) }}</div>
            <div>
              <button class="button button--ghost" @click="avatarMenu = !avatarMenu">แก้ไขรูป</button>
              <div v-if="avatarMenu" class="avatar-menu">
                <button @click="uploadInput.click()">อัปโหลดรูป…</button>
                <button @click="removeAvatar">ลบรูป</button>
              </div>
              <input ref="uploadInput" hidden type="file" accept="image/png,image/jpeg,image/webp" @change="selectAvatar" />
            </div>
          </div>
          <AvatarEditor v-if="cropFile" :file="cropFile" :busy="busy" @save="saveAvatar" @error="avatarError" @cancel="cropFile = null" />
          <form class="form" @submit.prevent="saveProfile">
            <label>ชื่อที่แสดง<input v-model="profile.displayName" maxlength="100" required :disabled="nameLocked" /><small v-if="nameLocked">เปลี่ยนได้อีกครั้งวันที่ {{ nextDate.toLocaleDateString('th-TH') }}</small></label>
            <label>แนะนำตัว<textarea v-model="profile.bio" maxlength="300" rows="4" /></label>
            <button class="button button--primary" :disabled="busy">บันทึกโปรไฟล์</button>
          </form>
        </section>

        <section v-show="activeSection === 'account'" id="account" class="settings-section">
          <h2>บัญชี</h2>
          <dl class="metadata-list">
            <div><dt>อีเมล</dt><dd>{{ data.account.email }}</dd></div>
            <div><dt>บทบาท</dt><dd>{{ data.account.role }}</dd></div>
            <div><dt>ยืนยันอีเมล</dt><dd>{{ data.account.emailVerified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน' }}</dd></div>
            <div><dt>สาขาปัจจุบัน</dt><dd>{{ programName(data.profile.program) }}</dd></div>
            <div><dt>รุ่นปัจจุบัน</dt><dd>{{ data.profile.cohort }}</dd></div>
          </dl>
          <form class="form" @submit.prevent="requestChange">
            <label>ประเภทคำขอ<select v-model="change.category"><option value="PROGRAM">ต้องการเปลี่ยนสาขา</option><option value="COHORT">ต้องการเปลี่ยนรุ่น</option></select></label>
            <label>ค่าที่ต้องการ<select v-if="change.category === 'PROGRAM'" v-model="change.requestedValue" required><option value="" disabled>เลือกสาขา</option><option v-for="item in PROGRAM_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option></select><select v-else v-model="change.requestedValue" required><option value="" disabled>เลือกรุ่น</option><option v-for="item in cohortOptions()" :key="item" :value="item">รุ่น {{ item }}</option></select></label>
            <label>เหตุผล<textarea v-model="change.reason" minlength="5" maxlength="500" required /></label>
            <button class="button button--ghost" :disabled="busy">ส่งคำขอให้ผู้ดูแล</button>
          </form>
          <h3>ประวัติคำขอ</h3>
          <div v-if="!data.changeRequests.length" class="empty-state">ยังไม่มีคำขอ</div>
          <article v-for="request in data.changeRequests" :key="request.id" class="settings-request">
            <strong>{{ request.category }}: {{ request.current_value }} → {{ request.requested_value }}</strong><span class="type-chip">{{ request.status }}</span><p>{{ request.reason }}</p><p v-if="request.decision_reason">ผู้ดูแล: {{ request.decision_reason }}</p>
          </article>
        </section>

        <section v-show="activeSection === 'privacy'" id="privacy" class="settings-section">
          <h2>ความเป็นส่วนตัว</h2>
          <p class="info-note">ดูรายละเอียดข้อมูลที่ระบบใช้จริงและรายการนโยบายที่ยังรอการยืนยันจากเจ้าของระบบ</p>
          <RouterLink to="/privacy" class="text-link">อ่านข้อมูลความเป็นส่วนตัว</RouterLink>
          <label><input v-model="privacy.profilePublic" type="checkbox" /> แสดงโปรไฟล์สาธารณะ</label>
          <label><input v-model="privacy.showProgram" type="checkbox" /> แสดงสาขา</label>
          <label><input v-model="privacy.showCohort" type="checkbox" /> แสดงรุ่น</label>
          <button class="button button--primary" :disabled="busy" @click="saveOptions">บันทึกความเป็นส่วนตัว</button>
        </section>

        <section v-show="activeSection === 'notifications'" id="notifications" class="settings-section">
          <h2>การแจ้งเตือน</h2>
          <label><input v-model="notifications.newFollower" type="checkbox" /> ผู้ติดตามใหม่</label>
          <label><input v-model="notifications.followedDocuments" type="checkbox" /> เอกสารใหม่จากผู้ที่ติดตาม</label>
          <label><input v-model="notifications.documentActivity" type="checkbox" /> กิจกรรมบนเอกสาร</label>
          <label><input v-model="notifications.activityEmail" type="checkbox" /> ส่งกิจกรรมทางอีเมล</label>
          <button class="button button--primary" :disabled="busy" @click="saveOptions">บันทึกการแจ้งเตือน</button>
        </section>

        <section v-show="activeSection === 'password'" id="password" class="settings-section">
          <h2>รหัสผ่านและความปลอดภัย</h2>
          <p>ใช้ขั้นตอนรีเซ็ตรหัสผ่านที่ปลอดภัยเมื่อต้องการตั้งรหัสผ่านใหม่</p>
          <RouterLink class="button button--ghost" to="/forgot-password">รีเซ็ตรหัสผ่าน</RouterLink>
        </section>
      </template>
    </main>
  </section>
</template>
