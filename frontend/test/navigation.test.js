import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UserDashboardView from '@/views/user/UserDashboardView.vue'

const DashboardShellStub = {
  name: 'DashboardShell',
  props: ['navItems'],
  template: '<main><slot /></main>'
}

describe('user dashboard navigation', () => {
  it('removes Following from the Navbar while preserving the other destinations', () => {
    const wrapper = mount(UserDashboardView, {
      global: {
        mocks: { $route: { fullPath: '/dashboard/home' } },
        stubs: {
          DashboardShell: DashboardShellStub,
          RouterView: true
        }
      }
    })

    const navItems = wrapper.findComponent(DashboardShellStub).props('navItems')
    expect(navItems).toEqual([
      { label: 'หน้าหลัก', to: '/dashboard/home' },
      { label: 'เอกสารการสอน', to: '/dashboard/lec' },
      { label: 'ชีทสรุป', to: '/dashboard/sheet' },
      { label: 'อัปโหลด', to: '/dashboard/upload' },
      { label: 'Collections', to: '/dashboard/collections' },
      { label: 'โปรไฟล์', to: '/dashboard/profile' }
    ])
    expect(navItems.some(item => item.to === '/dashboard/following')).toBe(false)
  })
})
