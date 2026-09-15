import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadNotifications = vi.fn()
const { contributions } = vi.hoisted(() => ({ contributions: vi.fn().mockResolvedValue({ total: 2, lectures: 1, sheets: 1, published: 1, pending: 1, rejected: 0, totalViews: 12, totalDownloads: 7, helpful: 3, contributionScore: 39, contributorLevel: 'Contributor', badges: ['First Contribution'], recent: [] }) }))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { username: 'student01', email: 'user@example.com', role: 'USER' } })
}))
vi.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    items: [], loading: false, error: '', unreadCount: 0,
    load: loadNotifications, markRead: vi.fn()
  })
}))
vi.mock('@/services/upload.service', () => ({ uploadApi: { contributions } }))

import UserProfilePanel from '@/components/user/UserProfilePanel.vue'

describe('Profile', () => {
  beforeEach(() => loadNotifications.mockClear())

  it('shows identity and both-type contribution statistics without an Upload form', async () => {
    const wrapper = mount(UserProfilePanel, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.get('h1').text()).toBe('โปรไฟล์และผลกระทบ')
    expect(wrapper.text()).toContain('การแบ่งปันของฉัน')
    expect(wrapper.text()).toContain('1 / 1')
    expect(wrapper.text()).toContain('12 ครั้งที่ดู')
    expect(wrapper.text()).toContain('7')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('Contributor · 39 คะแนน')
    expect(wrapper.text()).toContain('First Contribution')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
