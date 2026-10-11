import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  settings: vi.fn(), edit: vi.fn(), saveSettings: vi.fn(), requestChange: vi.fn(),
  uploadAvatar: vi.fn(), removeAvatar: vi.fn(), refresh: vi.fn()
}))
vi.mock('@/services/contributor.service', () => ({ contributorApi: mocks }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ refresh: mocks.refresh }) }))
import ProfileSettingsView from '@/views/user/ProfileSettingsView.vue'

const fixture = () => ({
  account: { email: 'student@example.test', role: 'USER', emailVerified: true },
  profile: {
    displayName: 'Student', bio: '', program: 'CS', cohort: '66', avatarUrl: '',
    profilePublic: true, showProgram: true, showCohort: true, nextDisplayNameChangeAt: null
  },
  notifications: { newFollower: true, followedDocuments: true, documentActivity: true, activityEmail: false },
  changeRequests: []
})

async function setup(location = '/dashboard/settings') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard/settings', name: 'profile-settings', component: ProfileSettingsView },
      { path: '/forgot-password', component: { template: '<div />' } }
    ]
  })
  await router.push(location)
  await router.isReady()
  const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('Settings category navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.settings.mockResolvedValue(fixture())
    mocks.refresh.mockResolvedValue({ username: 'student' })
  })

  it('opens a directly linked category and renders only that category as visible', async () => {
    const { wrapper } = await setup('/dashboard/settings#privacy')
    expect(wrapper.get('[aria-current="page"]').text()).toBe('ความเป็นส่วนตัว')
    expect(wrapper.get('#privacy').isVisible()).toBe(true)
    expect(wrapper.get('#public-profile').isVisible()).toBe(false)
    expect(wrapper.get('#notifications').isVisible()).toBe(false)
    expect(mocks.settings).toHaveBeenCalledTimes(1)
  })

  it('updates the URL and content immediately, then supports browser back', async () => {
    const { wrapper, router } = await setup('/dashboard/settings#privacy')
    await wrapper.get('a[href="/dashboard/settings#notifications"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.hash).toBe('#notifications')
    expect(wrapper.get('#notifications').isVisible()).toBe(true)
    expect(wrapper.get('#privacy').isVisible()).toBe(false)
    expect(wrapper.get('[aria-current="page"]').text()).toBe('การแจ้งเตือน')

    router.back()
    await vi.waitFor(() => {
      expect(router.currentRoute.value.hash).toBe('#privacy')
      expect(wrapper.get('[aria-current="page"]').text()).toBe('ความเป็นส่วนตัว')
      expect(wrapper.get('#privacy').attributes('style') || '').not.toContain('display: none')
      expect(wrapper.get('#notifications').attributes('style')).toContain('display: none')
    })
  })

  it('uses Public Profile as the safe default for an absent or unknown category', async () => {
    const { wrapper, router } = await setup('/dashboard/settings#unknown')
    expect(wrapper.get('#public-profile').isVisible()).toBe(true)
    expect(wrapper.get('[aria-current="page"]').text()).toBe('โปรไฟล์')
    await router.push('/dashboard/settings')
    await flushPromises()
    expect(wrapper.get('#public-profile').isVisible()).toBe(true)
  })
})
