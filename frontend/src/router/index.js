import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import LandingView from '@/views/LandingView.vue'
import LoginView from '@/views/auth/LoginView.vue'
import RegisterView from '@/views/auth/RegisterView.vue'
import UserDashboardView from '@/views/user/UserDashboardView.vue'
import AdminDashboardView from '@/views/admin/AdminDashboardView.vue'
import UserHomePanel from '@/components/user/UserHomePanel.vue'
import UserProfilePanel from '@/components/user/UserProfilePanel.vue'
import AdminRequestPanel from '@/components/admin/AdminRequestPanel.vue'
import AdminUploadPanel from '@/components/admin/AdminUploadPanel.vue'
import AdminStatusPanel from '@/components/admin/AdminStatusPanel.vue'
import AdminSubjectPanel from '@/components/admin/AdminSubjectPanel.vue'
import AdminDashboardPanel from '@/components/admin/AdminDashboardPanel.vue'
import CourseDetailPanel from '@/components/user/CourseDetailPanel.vue'
import CourseYearPanel from '@/components/user/CourseYearPanel.vue'
import DocumentSearchPanel from '@/components/user/DocumentSearchPanel.vue'
import DocumentCatalogPanel from '@/components/user/DocumentCatalogPanel.vue'
import UserUploadPanel from '@/components/user/UserUploadPanel.vue'
import PublicProfilePanel from '@/components/user/PublicProfilePanel.vue'
import DocumentDetailPanel from '@/components/user/DocumentDetailPanel.vue'

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
      { path: 'search', name: 'document-search', component: DocumentSearchPanel },
      { path: 'documents/:type/:id', name: 'document-detail', component: DocumentDetailPanel },
      { path: 'courses/:courseId', name: 'course-detail', component: CourseDetailPanel },
      { path: 'courses/:courseId/years/:year', name: 'course-year', component: CourseYearPanel },
      { path: 'sheet', name: 'user-sheet', component: DocumentCatalogPanel, props: { documentType: 'Sheet', basePath: '/dashboard/sheet' } },
      { path: 'sheet/:courseId', name: 'sheet-course', component: CourseDetailPanel, props: { documentType: 'Sheet', basePath: '/dashboard/sheet' } },
      { path: 'sheet/:courseId/years/:year', name: 'sheet-course-year', component: CourseYearPanel, props: { documentType: 'Sheet' } },
      { path: 'lec', name: 'user-lec', component: DocumentCatalogPanel, props: { documentType: 'Lecture', basePath: '/dashboard/lec' } },
      { path: 'lec/:courseId', name: 'lecture-course', component: CourseDetailPanel, props: { documentType: 'Lecture', basePath: '/dashboard/lec' } },
      { path: 'lec/:courseId/years/:year', name: 'lecture-course-year', component: CourseYearPanel, props: { documentType: 'Lecture' } },
      { path: 'upload', name: 'user-upload', component: UserUploadPanel },
      { path: 'requests', redirect: { name: 'user-upload' } },
      { path: 'notifications', redirect: { name: 'user-profile' } },
      { path: 'profile', name: 'user-profile', component: UserProfilePanel },
      { path: 'users/:username', name: 'public-profile', component: PublicProfilePanel }
    ]
  },
  {
    path: '/admin',
    component: AdminDashboardView,
    meta: { requiresAuth: true, role: 'ADMIN' },
    children: [
      { path: '', name: 'admin', redirect: { name: 'admin-dashboard' } },
      { path: 'request', name: 'admin-request', component: AdminRequestPanel },
      { path: 'upload', name: 'admin-upload', component: AdminUploadPanel },
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
