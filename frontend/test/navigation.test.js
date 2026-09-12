import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UserDashboardView from '@/views/user/UserDashboardView.vue'

const DashboardShellStub = {
  name: 'DashboardShell',
  props: ['navItems'],
  template: '<main><slot /></main>'
}

describe('user dashboard navigation', () => {
  it('uses exactly Home, Lectures, Sheets, Upload, and Profile', () => {
    const wrapper = mount(UserDashboardView, {
      global: {
        stubs: {
          DashboardShell: DashboardShellStub,
          RouterView: true
        }
      }
    })

    const navItems = wrapper.findComponent(DashboardShellStub).props('navItems')
    expect(navItems).toEqual([
      { label: 'Home', to: '/dashboard/home' },
      { label: 'Lectures', to: '/dashboard/lec' },
      { label: 'Sheets', to: '/dashboard/sheet' },
      { label: 'Upload', to: '/dashboard/upload' },
      { label: 'Profile', to: '/dashboard/profile' }
    ])
  })
})
