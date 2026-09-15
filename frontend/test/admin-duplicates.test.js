import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const { adminUploadRequests, adminDownloadUploadRequestFile } = vi.hoisted(() => ({ adminDownloadUploadRequestFile: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })), adminUploadRequests: vi.fn().mockResolvedValue([{
  id: 'r1', fileName: 'lecture.pdf', title: 'Lecture 01', courseName: 'Software Engineering',
  documentType: 'Lecture', academicYear: '2568', semester: '1', instructorName: 'Teacher',
  username: 'user1', status: 'PENDING', duplicateStatus: 'EXACT_DUPLICATE',
  duplicateMatches: [{ id: 'l1', title: 'Lecture 01', fileName: 'old.pdf', source: 'LECTURE', matchType: 'EXACT_DUPLICATE', binaryMatch: true, contentMatch: false }]
}]) }))
vi.mock('@/services/admin.service', () => ({ adminApi: { adminUploadRequests, adminDownloadUploadRequestFile } }))

import AdminRequestPanel from '@/components/admin/AdminRequestPanel.vue'

describe('Admin duplicate review', () => {
  it('shows duplicate matches and the explicit duplicate rejection action', async () => {
    const wrapper = mount(AdminRequestPanel)
    await flushPromises()
    expect(wrapper.text()).toContain('เอกสารซ้ำ')
    expect(wrapper.text()).toContain('Lecture 01')
    expect(wrapper.text()).toContain('ปฏิเสธว่าเอกสารซ้ำ')
    expect(wrapper.text()).toContain('2568 / 1')
    const duplicateButton = wrapper.findAll('button').find((button) => button.text() === 'ปฏิเสธว่าเอกสารซ้ำ')
    await duplicateButton.trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('ยืนยันว่าเอกสารซ้ำ')
    wrapper.unmount()
  })
})
