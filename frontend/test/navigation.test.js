import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UserDashboardView from '@/views/user/UserDashboardView.vue'

const DashboardShellStub = {
  name: 'DashboardShell',
  props: ['navItems'],
  template: '<main><slot /></main>'
}

describe('user dashboard navigation', () => {
  it('includes the following feed with the existing Thai-first destinations', () => {
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
      { label: 'กำลังติดตาม', to: '/dashboard/following' },
      { label: 'เอกสารการสอน', to: '/dashboard/lec' },
      { label: 'ชีทสรุป', to: '/dashboard/sheet' },
      { label: 'อัปโหลด', to: '/dashboard/upload' },
      { label: 'โปรไฟล์', to: '/dashboard/profile' }
    ])
  })
})
