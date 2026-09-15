import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const { uploadRequests } = vi.hoisted(() => ({ uploadRequests: vi.fn() }))

uploadRequests.mockResolvedValue([{
  id: 'request-1', title: 'Algorithms', fileName: 'algorithms.pdf', fileSize: 128,
  courseName: 'Algorithm', documentType: 'Lecture', academicYear: '2026',
  semester: '2', duplicateStatus: 'POSSIBLE_DUPLICATE',
  instructorName: 'Dr. Somchai', status: 'PENDING', createdAt: '2026-01-01', updatedAt: '2026-01-01'
}])

vi.mock('@/services/upload.service', () => ({
  uploadApi: { uploadRequests, downloadUploadRequestFile: vi.fn(), downloadPublishedFile: vi.fn() }
}))

import UserRequestsPanel from '@/components/user/UserRequestsPanel.vue'

describe('My Uploads', () => {
  it('loads and displays the current user request history', async () => {
    const wrapper = mount(UserRequestsPanel, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          UploadStatusTimeline: true
        }
      }
    })
    await flushPromises()

    expect(uploadRequests).toHaveBeenCalledOnce()
    expect(wrapper.get('h2').text()).toBe('การอัปโหลดของฉัน')
    expect(wrapper.text()).toContain('algorithms.pdf')
    expect(wrapper.text()).toContain('รอตรวจสอบ')
    expect(wrapper.text()).not.toContain('Submit upload')
  })
})
