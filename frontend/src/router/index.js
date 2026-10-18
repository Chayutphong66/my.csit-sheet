import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import LandingView from '@/views/LandingView.vue'

// Keep the public landing route small. Authenticated and administrative
// screens are fetched only when navigation needs them.
const LoginView = () => import('@/views/auth/LoginView.vue')
const RegisterView = () => import('@/views/auth/RegisterView.vue')
const PrivacyInformationView = () => import('@/views/PrivacyInformationView.vue')
const ForgotPasswordView = () => import('@/views/auth/ForgotPasswordView.vue')
const ResetPasswordView = () => import('@/views/auth/ResetPasswordView.vue')
const VerifyEmailView = () => import('@/views/auth/VerifyEmailView.vue')
const UserDashboardView = () => import('@/views/user/UserDashboardView.vue')
const AdminDashboardView = () => import('@/views/admin/AdminDashboardView.vue')
const UserHomePanel = () => import('@/components/user/UserHomePanel.vue')
const UserProfilePanel = () => import('@/components/user/UserProfilePanel.vue')
const AdminRequestPanel = () => import('@/components/admin/AdminRequestPanel.vue')
const AdminUploadPanel = () => import('@/components/admin/AdminUploadPanel.vue')
const AdminStatusPanel = () => import('@/components/admin/AdminStatusPanel.vue')
const AdminSubjectPanel = () => import('@/components/admin/AdminSubjectPanel.vue')
const AdminDashboardPanel = () => import('@/components/admin/AdminDashboardPanel.vue')
const AdminCollectionPanel = () => import('@/components/admin/AdminCollectionPanel.vue')
const CourseDetailPanel = () => import('@/components/user/CourseDetailPanel.vue')
const CourseYearPanel = () => import('@/components/user/CourseYearPanel.vue')
const DocumentSearchPanel = () => import('@/components/user/DocumentSearchPanel.vue')
const DocumentCatalogPanel = () => import('@/components/user/DocumentCatalogPanel.vue')
const UserUploadPanel = () => import('@/components/user/UserUploadPanel.vue')
const PublicProfilePanel = () => import('@/components/user/PublicProfilePanel.vue')
const DocumentDetailPanel = () => import('@/components/user/DocumentDetailPanel.vue')
const ProfileSettingsView = () => import('@/views/user/ProfileSettingsView.vue')
const FollowingFeedView = () => import('@/views/user/FollowingFeedView.vue')
const UserCollectionPanel = () => import('@/components/user/UserCollectionPanel.vue')
const CollectionEditorPanel = () => import('@/components/user/CollectionEditorPanel.vue')
const PublishedCollectionPanel = () => import('@/components/user/PublishedCollectionPanel.vue')
const CollectionReaderPanel = () => import('@/components/user/CollectionReaderPanel.vue')
const UserFeedbackPanel = () => import('@/components/user/UserFeedbackPanel.vue')
const AdminFeedbackPanel = () => import('@/components/admin/AdminFeedbackPanel.vue')

const routes = [
  { path: '/', name: 'home', component: LandingView },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/register', name: 'register', component: RegisterView },
  { path: '/privacy', name: 'privacy-policy', component: PrivacyInformationView },
  { path: '/forgot-password', name: 'forgot-password', component: ForgotPasswordView },
  { path: '/reset-password', name: 'reset-password', component: ResetPasswordView },
  { path: '/verify-email', name: 'verify-email', component: VerifyEmailView },
  {
    path: '/dashboard',
    component: UserDashboardView,
    meta: { requiresAuth: true, role: 'USER' },
    children: [
      { path: '', name: 'dashboard', redirect: { name: 'user-home' } },
      { path: 'home', name: 'user-home', component: UserHomePanel },
      { path: 'following', name: 'following-feed', component: FollowingFeedView },
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
      { path: 'collections', name: 'user-collections', component: UserCollectionPanel },
      { path: 'collections/:id/edit', name: 'collection-edit', component: CollectionEditorPanel },
      { path: 'c/:slug', name: 'published-collection', component: PublishedCollectionPanel },
      { path: 'c/:slug/read/:type?/:documentId?', name: 'collection-reader', component: CollectionReaderPanel },
      { path: 'requests', redirect: { name: 'user-upload' } },
      { path: 'notifications', redirect: { name: 'user-profile' } },
      { path: 'profile', name: 'user-profile', component: UserProfilePanel },
      { path: 'settings', name: 'profile-settings', component: ProfileSettingsView },
      { path: 'feedback', name: 'user-feedback', component: UserFeedbackPanel },
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
      { path: 'collections', name: 'admin-collections', component: AdminCollectionPanel },
      { path: 'dashboard', name: 'admin-dashboard', component: AdminDashboardPanel },
      { path: 'feedback', name: 'admin-feedback', component: AdminFeedbackPanel }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.name === 'profile-settings') return { top: 0 }
    if (to.hash) return { el: to.hash, top: 100 }
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
