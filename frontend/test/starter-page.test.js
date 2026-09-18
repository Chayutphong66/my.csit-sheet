import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ user: null }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => auth }))
import LandingView from '@/views/LandingView.vue'

const options = { global: { stubs: {
  AppNavbar: true,
  RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }
} } }

afterEach(() => { auth.user = null; vi.unstubAllGlobals() })
describe('Starter page', () => {
  it('uses working authentication destinations, labels its demo and allows pausing', async () => {
    const wrapper = mount(LandingView, options)
    expect(wrapper.get('main').attributes('id')).toBe('starter-main')
    expect(wrapper.find('a[href="/login?redirect=/dashboard/search"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/register"]').exists()).toBe(true)
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toContain('ไม่ใช่ข้อมูลเอกสารจริง')
    await wrapper.get('.motion-toggle').trigger('click')
    expect(wrapper.classes()).toContain('motion-paused')
    expect(wrapper.get('.motion-toggle').attributes('aria-pressed')).toBe('true')
    await wrapper.get('.motion-toggle').trigger('click')
    expect(wrapper.classes()).not.toContain('motion-paused')
    wrapper.unmount()
  })

  it.each([
    ['USER', '/dashboard/search', '/dashboard/upload'],
    ['ADMIN', '/admin', '/admin/upload']
  ])('routes %s to permitted product screens and disconnects its observer', (role, browse, share) => {
    const disconnect = vi.fn()
    const observe = vi.fn()
    vi.stubGlobal('IntersectionObserver', class { observe = observe; disconnect = disconnect })
    auth.user = { role }
    const wrapper = mount(LandingView, options)
    expect(wrapper.find(`a[href="${browse}"]`).exists()).toBe(true)
    expect(wrapper.find(`a[href="${share}"]`).exists()).toBe(true)
    expect(observe).toHaveBeenCalled()
    wrapper.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
