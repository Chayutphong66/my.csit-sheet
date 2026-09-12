import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadNotifications = vi.fn()
const { contributions } = vi.hoisted(() => ({ contributions: vi.fn().mockResolvedValue({ total: 2, lectures: 1, sheets: 1, published: 1, pending: 1, rejected: 0, recent: [] }) }))

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

    expect(wrapper.get('h1').text()).toBe('Profile')
    expect(wrapper.text()).toContain('My Contributions')
    expect(wrapper.text()).toContain('Lectures1')
    expect(wrapper.text()).toContain('Sheets1')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
