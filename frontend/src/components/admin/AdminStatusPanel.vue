<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { adminApi } from '@/services/admin.service'
import { useAuthStore } from '@/stores/authStore'
import UserIdentity from '@/components/shared/UserIdentity.vue'

const auth = useAuthStore()
const users = ref([])
const pagination = reactive({ page: 1, limit: 12, total: 0, totalPages: 1 })
const search = ref('')
const status = ref('')
const selected = ref(null)
const audit = ref([])
const loading = ref(true)
const detailLoading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const statusReason = ref('')
const form = reactive({ displayName: '', bio: '', program: '', cohort: '', profilePublic: true, showProgram: true, showCohort: true })

const isSelf = computed(() => selected.value?.id === auth.user?.id)
const canPrevious = computed(() => pagination.page > 1)
const canNext = computed(() => pagination.page < pagination.totalPages)

function fillForm(user) {
  Object.assign(form, {
    displayName: user.displayName || '', bio: user.bio || '', program: user.program || '', cohort: user.cohort || '',
    profilePublic: user.profilePublic, showProgram: user.showProgram, showCohort: user.showCohort
  })
}

async function loadDetail(id) {
  detailLoading.value = true; error.value = ''; success.value = ''
  try {
    const data = await adminApi.adminUser(id)
    selected.value = data.user; audit.value = data.audit; fillForm(data.user); statusReason.value = ''
  } catch (cause) { error.value = cause.message || 'โหลดรายละเอียดผู้ใช้ไม่สำเร็จ' }
  finally { detailLoading.value = false }
}

async function loadUsers({ keepSelection = false } = {}) {
  loading.value = true; error.value = ''
  try {
    const data = await adminApi.adminUsers({ search: search.value, status: status.value, page: pagination.page, limit: pagination.limit })
    users.value = data.items; Object.assign(pagination, data.pagination)
    const stillVisible = keepSelection && users.value.some(user => user.id === selected.value?.id)
    if (stillVisible) await loadDetail(selected.value.id)
    else if (users.value[0]) await loadDetail(users.value[0].id)
    else { selected.value = null; audit.value = [] }
  } catch (cause) { error.value = cause.message || 'โหลดรายชื่อผู้ใช้งานไม่สำเร็จ' }
  finally { loading.value = false }
}

async function submitSearch() { pagination.page = 1; await loadUsers() }
async function movePage(offset) { pagination.page += offset; await loadUsers() }

async function saveProfile() {
  saving.value = true; error.value = ''; success.value = ''
  try {
    selected.value = await adminApi.updateAdminUser(selected.value.id, { ...form })
    fillForm(selected.value); success.value = 'บันทึกข้อมูลผู้ใช้แล้ว'; await loadUsers({ keepSelection: true })
  } catch (cause) { error.value = cause.message }
  finally { saving.value = false }
}

async function changeStatus(nextStatus) {
  saving.value = true; error.value = ''; success.value = ''
  try {
    selected.value = await adminApi.updateAdminUserStatus(selected.value.id, nextStatus, statusReason.value)
    success.value = nextStatus === 'ACTIVE' ? 'เปิดใช้งานบัญชีแล้ว' : 'ปิดใช้งานบัญชีแล้วและยกเลิก session ที่ค้างอยู่'
    await loadUsers({ keepSelection: true })
  } catch (cause) { error.value = cause.message }
  finally { saving.value = false }
}

onMounted(() => loadUsers())
</script>
<template>
  <section class="page-panel admin-users-panel">
    <div class="panel__header">
      <div><p class="eyebrow">Admin user management</p><h1>จัดการผู้ใช้งาน</h1><p>ค้นหา ตรวจสอบ และแก้ไขข้อมูลโปรไฟล์ โดยไม่เปลี่ยน Role, รหัสผ่าน หรือข้อมูลยืนยันตัวตน</p></div>
      <span class="count-pill">{{ pagination.total }} บัญชี</span>
    </div>

    <form class="admin-user-filters" role="search" @submit.prevent="submitSearch">
      <label><span>ค้นหา</span><input v-model="search" type="search" placeholder="ชื่อ, username หรืออีเมล" maxlength="100"></label>
      <label><span>สถานะบัญชี</span><select v-model="status"><option value="">ทั้งหมด</option><option value="ACTIVE">ใช้งานอยู่</option><option value="DEACTIVATED">ปิดใช้งาน</option></select></label>
      <button class="button button--primary" type="submit">ค้นหา</button>
    </form>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="success" class="form-success" role="status">{{ success }}</p>
    <div v-if="loading" class="loading-state">กำลังโหลด…</div>
    <div v-else-if="!users.length" class="empty-state">ไม่พบบัญชีที่ตรงกับเงื่อนไข</div>
    <div v-else class="admin-user-layout">
      <div>
        <div class="admin-user-list" aria-label="รายชื่อผู้ใช้">
          <button v-for="user in users" :key="user.id" type="button" class="admin-user-card" :class="{ 'is-selected': selected?.id === user.id }" @click="loadDetail(user.id)">
            <UserIdentity :username="user.username" :display-name="user.displayName" :program="user.program" :cohort="user.cohort" :linked="false" compact />
            <span class="status-badge" :class="user.accountStatus === 'ACTIVE' ? 'status-badge--success' : 'status-badge--danger'">{{ user.accountStatus === 'ACTIVE' ? 'ใช้งานอยู่' : 'ปิดใช้งาน' }}</span>
          </button>
        </div>
        <nav class="admin-user-pagination" aria-label="แบ่งหน้ารายชื่อผู้ใช้">
          <button class="button button--ghost button--small" type="button" :disabled="!canPrevious" @click="movePage(-1)">ก่อนหน้า</button>
          <span>หน้า {{ pagination.page }} / {{ pagination.totalPages }}</span>
          <button class="button button--ghost button--small" type="button" :disabled="!canNext" @click="movePage(1)">ถัดไป</button>
        </nav>
      </div>

      <div v-if="detailLoading" class="loading-state">กำลังโหลดรายละเอียด…</div>
      <article v-else-if="selected" class="admin-user-detail">
        <header><UserIdentity :username="selected.username" :display-name="selected.displayName" :program="selected.program" :cohort="selected.cohort" :linked="false" /><span class="role-chip">{{ selected.role }}</span></header>
        <dl class="admin-user-metrics">
          <div><dt>อีเมล</dt><dd>{{ selected.email }}</dd></div><div><dt>ยืนยันแล้ว</dt><dd>{{ selected.isVerified ? 'ใช่' : 'ยัง' }}</dd></div>
          <div><dt>Lecture</dt><dd>{{ selected.lectureCount }}</dd></div><div><dt>Sheet</dt><dd>{{ selected.sheetCount }}</dd></div>
          <div><dt>Uploads</dt><dd>{{ selected.uploadCount }}</dd></div><div><dt>Contributions</dt><dd>{{ selected.contributionCount }}</dd></div>
        </dl>

        <form class="admin-user-edit" @submit.prevent="saveProfile">
          <h2>ข้อมูลที่แก้ไขได้</h2>
          <div class="form-grid"><label><span>ชื่อที่แสดง</span><input v-model="form.displayName" minlength="2" maxlength="80" required></label><label><span>สาขา</span><select v-model="form.program"><option value="">ไม่ระบุ</option><option value="CS">CS</option><option value="IT">IT</option></select></label><label><span>รุ่น</span><input v-model="form.cohort" inputmode="numeric" pattern="[0-9]{2}" maxlength="2" placeholder="เช่น 66"></label></div>
          <label><span>แนะนำตัว</span><textarea v-model="form.bio" maxlength="500" rows="3"></textarea></label>
          <fieldset class="admin-user-privacy"><legend>การเปิดเผยโปรไฟล์</legend><label><input v-model="form.profilePublic" type="checkbox"> โปรไฟล์สาธารณะ</label><label><input v-model="form.showProgram" type="checkbox"> แสดงสาขา</label><label><input v-model="form.showCohort" type="checkbox"> แสดงรุ่น</label></fieldset>
          <button class="button button--primary" type="submit" :disabled="saving">บันทึกข้อมูล</button>
        </form>

        <section class="admin-account-status">
          <h2>สถานะบัญชี</h2>
          <p v-if="selected.accountStatus === 'DEACTIVATED'">ปิดใช้งานเมื่อ {{ selected.deactivatedAt || '-' }} — {{ selected.deactivationReason }}</p>
          <template v-if="selected.accountStatus === 'ACTIVE'">
            <label><span>เหตุผลที่ปิดใช้งาน</span><textarea v-model="statusReason" minlength="5" maxlength="500" rows="2" :disabled="isSelf"></textarea></label>
            <button class="button button--danger-soft" type="button" :disabled="saving || isSelf || statusReason.trim().length < 5" @click="changeStatus('DEACTIVATED')">ปิดใช้งานบัญชี</button>
            <small v-if="isSelf">ไม่สามารถปิดใช้งานบัญชีของตนเองได้</small>
          </template>
          <button v-else class="button button--selected" type="button" :disabled="saving" @click="changeStatus('ACTIVE')">เปิดใช้งานบัญชี</button>
        </section>

        <section class="admin-audit-list"><h2>Audit Log ล่าสุด</h2><p v-if="!audit.length">ยังไม่มีประวัติการจัดการ</p><ol v-else><li v-for="entry in audit" :key="entry.id"><strong>{{ entry.action }}</strong><span>โดย @{{ entry.actorUsername }} · {{ entry.createdAt }}</span></li></ol></section>
      </article>
    </div>
  </section>
</template>
