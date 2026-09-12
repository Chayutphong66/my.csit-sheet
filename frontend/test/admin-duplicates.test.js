import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const { adminUploadRequests } = vi.hoisted(() => ({ adminUploadRequests: vi.fn().mockResolvedValue([{
  id: 'r1', fileName: 'lecture.pdf', title: 'Lecture 01', courseName: 'Software Engineering',
  documentType: 'Lecture', academicYear: '2568', semester: '1', instructorName: 'Teacher',
  username: 'user1', status: 'PENDING', duplicateStatus: 'EXACT_DUPLICATE',
  duplicateMatches: [{ id: 'l1', title: 'Lecture 01', source: 'LECTURE', matchType: 'EXACT_DUPLICATE' }]
}]) }))
vi.mock('@/services/admin.service', () => ({ adminApi: { adminUploadRequests } }))

import AdminRequestPanel from '@/components/admin/AdminRequestPanel.vue'

describe('Admin duplicate review', () => {
  it('shows duplicate matches and the explicit duplicate rejection action', async () => {
    const wrapper = mount(AdminRequestPanel)
    await flushPromises()
    expect(wrapper.text()).toContain('EXACT_DUPLICATE')
    expect(wrapper.text()).toContain('Lecture 01 (LECTURE)')
    expect(wrapper.text()).toContain('Reject as Duplicate')
    expect(wrapper.text()).toContain('Semester 1')
  })
})
