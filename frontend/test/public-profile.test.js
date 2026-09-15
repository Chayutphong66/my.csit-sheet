import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const profile = vi.hoisted(() => vi.fn().mockResolvedValue({
  username: 'user1', displayName: 'สมชาย นักแบ่งปัน', avatarUrl: '', contributorLevel: 'Contributor',
  contributionScore: 27, publishedCount: 1, lectureCount: 1, sheetCount: 0,
  totalDownloads: 1, totalViews: 1, helpful: 1, badges: ['First Contribution'], documents: []
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { username: 'user1' } }) }))
vi.mock('@/services/contributor.service', () => ({ contributorApi: { profile } }))
vi.mock('@/services/document.service', () => ({ documentApi: {} }))

import PublicProfilePanel from '@/components/user/PublicProfilePanel.vue'

describe('Public contributor profile', () => {
  it('renders safe public recognition without private account fields', async () => {
    const wrapper = mount(PublicProfilePanel, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, DocumentImpactActions: true } } })
    await flushPromises()
    expect(profile).toHaveBeenCalledWith('user1')
    expect(wrapper.text()).toContain('สมชาย นักแบ่งปัน')
    expect(wrapper.text()).toContain('@user1')
    expect(wrapper.text()).toContain('Contributor · 27 คะแนน')
    expect(wrapper.text()).toContain('First Contribution')
    expect(wrapper.text()).not.toContain('อีเมลส่วนตัว')
    expect(wrapper.text()).not.toContain('รอตรวจสอบ')
  })
})
