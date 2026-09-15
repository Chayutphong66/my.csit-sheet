<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const open = ref(false)
const scrolled = ref(false)

const navItems = [
  { label: 'จุดเด่น', id: 'features' },
  { label: 'วิธีใช้งาน', id: 'workflow' },
  { label: 'ติดต่อ', id: 'contact' }
]

function onScroll() {
  scrolled.value = window.scrollY > 16
}

function goSection(id) {
  open.value = false
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

async function logout() {
  await auth.logout()
  router.push('/')
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll)
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <header class="navbar" :class="{ 'navbar--solid': scrolled || open }">
    <nav class="navbar__inner">
      <RouterLink to="/" class="brand" @click="open = false">
        <span class="brand__mark">CS</span>
        <span>CSIT Sheet</span>
      </RouterLink>

      <div class="navbar__links">
        <button v-for="item in navItems" :key="item.id" class="nav-link" type="button" @click="goSection(item.id)">
          {{ item.label }}
        </button>
        <RouterLink v-if="!auth.user" class="button button--primary" to="/login">เข้าสู่ระบบ</RouterLink>
        <RouterLink v-else-if="auth.user.role === 'ADMIN'" class="button button--primary" to="/admin">พื้นที่ผู้ดูแล</RouterLink>
        <RouterLink v-else class="button button--primary" to="/dashboard">ไปที่หน้าหลัก</RouterLink>
        <button v-if="auth.user" class="button button--ghost" type="button" @click="logout">ออกจากระบบ</button>
      </div>

      <button class="icon-button" type="button" aria-label="เปิดหรือปิดเมนู" @click="open = !open">
        {{ open ? 'ปิด' : 'เมนู' }}
      </button>
    </nav>

    <div v-if="open" class="mobile-menu">
      <button v-for="item in navItems" :key="item.id" class="mobile-menu__item" type="button" @click="goSection(item.id)">
        {{ item.label }}
      </button>
      <RouterLink v-if="!auth.user" class="button button--primary" to="/login" @click="open = false">เข้าสู่ระบบ</RouterLink>
      <RouterLink v-else-if="auth.user.role === 'ADMIN'" class="button button--primary" to="/admin" @click="open = false">พื้นที่ผู้ดูแล</RouterLink>
      <RouterLink v-else class="button button--primary" to="/dashboard" @click="open = false">ไปที่หน้าหลัก</RouterLink>
      <button v-if="auth.user" class="button button--ghost" type="button" @click="logout">ออกจากระบบ</button>
    </div>
  </header>
</template>
