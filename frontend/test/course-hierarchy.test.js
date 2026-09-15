import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const { courses, search } = vi.hoisted(() => ({ courses: vi.fn().mockResolvedValue([
  { id: 'c1', code: 'CS201', name: 'Algorithm', description: 'Algorithms', documentCount: 3 }
]), search: vi.fn().mockResolvedValue({ documents: [] }) }))
vi.mock('@/services/document.service', () => ({ documentApi: { courses, search } }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { username: 'user1' } }) }))

import UserHomePanel from '@/components/user/UserHomePanel.vue'
import DocumentCatalogPanel from '@/components/user/DocumentCatalogPanel.vue'

describe('Course hierarchy home', () => {
  it('renders database-provided course codes and accessible counts', async () => {
    const wrapper = mount(UserHomePanel, { global: { stubs: { RouterLink: { props: ['to'], template: '<a><slot /></a>' } } } })
    await flushPromises()
    expect(courses).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('CS201')
    expect(wrapper.text()).toContain('3 เอกสาร')
    expect(wrapper.text()).toContain('Algorithm')
  })

  it('passes the structured document type into typed catalogs', async () => {
    const wrapper = mount(DocumentCatalogPanel, { props: { documentType: 'Lecture', basePath: '/dashboard/lec' }, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    expect(courses).toHaveBeenCalledWith('Lecture')
    expect(wrapper.text()).toContain('เอกสารการสอน')
    expect(wrapper.text()).toContain('3 เอกสาร')
  })
})
