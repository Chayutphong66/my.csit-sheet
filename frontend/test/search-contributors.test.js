import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const { documentSearch, contributorSearch } = vi.hoisted(() => ({
  documentSearch: vi.fn().mockResolvedValue({ documents: [{ id: 'd1', title: 'Database Notes', documentType: 'Sheet', courseCode: 'CS230', courseName: 'Database', courseId: 'c1', academicYear: '2568', semester: '1' }] }),
  contributorSearch: vi.fn().mockResolvedValue({ contributors: [{ username: 'user1', displayName: 'สมชาย นักแบ่งปัน', avatarUrl: '', contributorLevel: 'Contributor', publishedCount: 2, helpful: 4 }] })
}))
vi.mock('@/services/document.service', () => ({ documentApi: { search: documentSearch } }))
vi.mock('@/services/contributor.service', () => ({ contributorApi: { search: contributorSearch } }))

import DocumentSearchPanel from '@/components/user/DocumentSearchPanel.vue'

describe('Unified search', () => {
  it('separates contributors and documents and links the contributor profile', async () => {
    const wrapper = mount(DocumentSearchPanel, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :data-to="to"><slot /></a>' }, DocumentImpactActions: true } } })
    await wrapper.get('input[type="search"]').setValue('สมชาย')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(documentSearch).toHaveBeenCalledWith('สมชาย')
    expect(contributorSearch).toHaveBeenCalledWith('สมชาย')
    expect(wrapper.text()).toContain('ผู้แบ่งปัน')
    expect(wrapper.text()).toContain('เอกสาร')
    expect(wrapper.text()).toContain('@user1')
    expect(wrapper.text()).toContain('Database Notes')
    expect(wrapper.find('[data-to="/dashboard/users/user1"]').exists()).toBe(true)
  })
})
