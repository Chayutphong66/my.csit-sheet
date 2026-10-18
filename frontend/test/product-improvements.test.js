import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ref } from 'vue'
import DashboardShell from '@/components/layout/DashboardShell.vue'

vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { role: 'USER', username: 'student' }, logout: vi.fn() }) }))
vi.mock('@/stores/notificationStore', () => ({ useNotificationStore: () => ({ unreadCount: ref(0), load: vi.fn() }) }))

describe('product navigation improvements', () => {
  it('uses an accessible SVG search icon with the existing 44px hit target class', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }, { path: '/dashboard/search', component: { template: '<div />' } }, { path: '/dashboard/home', component: { template: '<div />' } }, { path: '/dashboard/profile', component: { template: '<div />' } }] })
    await router.push('/'); await router.isReady()
    const wrapper = mount(DashboardShell, { props: { roleLabel: 'ผู้ใช้งาน', navItems: [] }, global: { plugins: [router] } })
    const search = wrapper.get('.search-shortcut')
    expect(search.attributes('aria-label')).toBe('ค้นหาเอกสาร')
    expect(search.find('svg').exists()).toBe(true)
    expect(search.text()).not.toContain('⌕')
  })
})
