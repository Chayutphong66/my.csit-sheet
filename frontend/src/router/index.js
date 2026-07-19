import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import LandingView from '@/views/LandingView.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import UserDashboardView from '@/views/UserDashboardView.vue'
import AdminDashboardView from '@/views/AdminDashboardView.vue'
import UserHomePanel from '@/components/user/UserHomePanel.vue'
import UserSheetPanel from '@/components/user/UserSheetPanel.vue'
import UserLecPanel from '@/components/user/UserLecPanel.vue'
import UserUploadPanel from '@/components/user/UserUploadPanel.vue'
import UserProfilePanel from '@/components/user/UserProfilePanel.vue'
import AdminRequestPanel from '@/components/admin/AdminRequestPanel.vue'
import AdminStatusPanel from '@/components/admin/AdminStatusPanel.vue'
import AdminSubjectPanel from '@/components/admin/AdminSubjectPanel.vue'
import AdminDashboardPanel from '@/components/admin/AdminDashboardPanel.vue'

const routes = [
  { path: '/', name: 'home', component: LandingView },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/register', name: 'register', component: RegisterView },
  {
    path: '/dashboard',
    component: UserDashboardView,
    meta: { requiresAuth: true, role: 'USER' },
    children: [
      { path: '', name: 'dashboard', redirect: { name: 'user-home' } },
      { path: 'home', name: 'user-home', component: UserHomePanel },
      { path: 'sheet', name: 'user-sheet', component: UserSheetPanel },
      { path: 'lec', name: 'user-lec', component: UserLecPanel },
      { path: 'upload', name: 'user-upload', component: UserUploadPanel },
      { path: 'profile', name: 'user-profile', component: UserProfilePanel }
    ]
  },
  {
    path: '/admin',
    component: AdminDashboardView,
    meta: { requiresAuth: true, role: 'ADMIN' },
    children: [
      { path: '', name: 'admin', redirect: { name: 'admin-request' } },
      { path: 'request', name: 'admin-request', component: AdminRequestPanel },
      { path: 'status', name: 'admin-status', component: AdminStatusPanel },
      { path: 'subject', name: 'admin-subject', component: AdminSubjectPanel },
      { path: 'dashboard', name: 'admin-dashboard', component: AdminDashboardPanel }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) {
    await auth.refresh()
  }

  if (!to.meta.requiresAuth) return true
  if (!auth.user) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.role && auth.user.role !== to.meta.role) {
    return auth.user.role === 'ADMIN' ? { name: 'admin' } : { name: 'dashboard' }
  }
  return true
})

export default router
