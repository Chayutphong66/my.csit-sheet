import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  adminUploadRequests: vi.fn(), adminDownloadUploadRequestFile: vi.fn(), revisions: vi.fn(),
  approveUploadRequest: vi.fn(), rejectUploadRequest: vi.fn(), rejectDuplicateUploadRequest: vi.fn(),
  approveRevision: vi.fn(), rejectRevision: vi.fn(), revisionFile: vi.fn(), restoreVersion: vi.fn(),
  versions: vi.fn()
}))
vi.mock('@/services/admin.service', () => ({ adminApi: api }))
vi.mock('@/services/document.service', () => ({
  documentApi: { versions: api.versions, viewVersion: vi.fn(), downloadVersion: vi.fn() },
  downloadDocumentBlob: vi.fn(), openDocumentBlob: vi.fn()
}))
import AdminRequestPanel from '@/components/admin/AdminRequestPanel.vue'

const upload = (id, status) => ({ id, status, title: `Upload ${id}`, fileName: `${id}.txt`, fileSize: 10,
  username: 'student', displayName: 'Student', contributorProgram: 'CS', contributorCohort: '66', documentType: 'Sheet', courseName: 'Software Engineering',
  academicYear: '2569', semester: '1', createdAt: '2026-09-28T00:00:00Z', duplicateStatus: 'NONE', duplicateMatches: [], teacherSuggestions: [] })
const revision = (id, status, extra = {}) => ({ id, status, documentId: 'doc-1', documentType: 'Lecture', documentTitle: `Revision ${id}`,
  courseCode: 'CS101', academicYear: '2569', semester: '1', currentVersionNumber: 1, versionNumber: status === 'APPROVED' ? 2 : null,
  contributorUsername: 'student', contributorDisplayName: 'Student', contributorAvatarUrl: '', contributorProgram: 'CS', contributorCohort: '66', revisionType: 'ADD_CONTENT',
  changeSummary: 'Added examples', originalFileName: `${id}.txt`, fileSize: 10, createdAt: '2026-09-28T00:00:00Z', ...extra })

let wrapper, uploads, revisions
beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState({}, '', '/')
  uploads = [upload('u-pending', 'PENDING'), upload('u-approved', 'COMPLETED'), upload('u-rejected', 'REJECTED')]
  revisions = [revision('r-pending', 'PENDING'), revision('r-approved', 'APPROVED')]
  api.adminUploadRequests.mockImplementation(async () => uploads)
  api.revisions.mockImplementation(async () => ({ revisions }))
  api.versions.mockResolvedValue({ versions: [] })
  api.adminDownloadUploadRequestFile.mockResolvedValue(new Blob(['file'], { type: 'text/plain' }))
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:review'), revokeObjectURL: vi.fn() })
})
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })

function tab(label) { return wrapper.findAll('[role="tab"]').find(button => button.text().startsWith(label)) }
function statuses() { return wrapper.findAll('[data-review-status]').map(card => card.attributes('data-review-status')) }

describe('Admin review status filter', () => {
  it('keeps authoritative 2/2/1 counters while PENDING, APPROVED, REJECTED, and ALL change the rendered cards', async () => {
    wrapper = mount(AdminRequestPanel)
    await flushPromises()

    expect(wrapper.findAll('.queue-summary strong').map(item => item.text())).toEqual(['2', '2', '1', '5'])
    expect(statuses()).toEqual(['PENDING', 'PENDING'])
    expect(wrapper.text()).toContain('CS รุ่น 66')

    await tab('APPROVED').trigger('click'); await flushPromises()
    expect(statuses()).toEqual(['APPROVED', 'APPROVED'])
    expect(wrapper.findAll('.approval-actions')).toHaveLength(0)

    await tab('REJECTED').trigger('click'); await flushPromises()
    expect(statuses()).toEqual(['REJECTED'])
    expect(wrapper.text()).toContain('ดูรายละเอียด')

    await tab('ทั้งหมด').trigger('click'); await flushPromises()
    expect(statuses().sort()).toEqual(['APPROVED', 'APPROVED', 'PENDING', 'PENDING', 'REJECTED'])
    expect(wrapper.findAll('.queue-summary strong').map(item => item.text())).toEqual(['2', '2', '1', '5'])
  })

  it('renders an error with retry instead of claiming a failed request is empty', async () => {
    api.adminUploadRequests.mockRejectedValue(new Error('API unavailable'))
    wrapper = mount(AdminRequestPanel)
    await flushPromises()
    const legacy = wrapper.get('[data-review-kind="upload"]')
    expect(legacy.get('[role="alert"]').text()).toContain('API unavailable')
    expect(legacy.text()).not.toContain('ไม่มีเอกสารใหม่ที่รอตรวจสอบ')
    expect(legacy.text()).toContain('ลองอีกครั้ง')
  })

  it('restores the APPROVED filter from the URL after a page refresh', async () => {
    window.history.replaceState({}, '', '/admin/request?status=APPROVED')
    wrapper = mount(AdminRequestPanel)
    await flushPromises()
    expect(tab('APPROVED').attributes('aria-selected')).toBe('true')
    expect(statuses()).toEqual(['APPROVED', 'APPROVED'])
  })

  it('moves an approved revision out of Pending, into Approved, and refreshes invariant counters', async () => {
    api.approveRevision.mockImplementation(async (id) => {
      revisions = revisions.map(item => item.id === id ? { ...item, status: 'APPROVED', versionNumber: 3 } : item)
      return revisions.find(item => item.id === id)
    })
    wrapper = mount(AdminRequestPanel)
    await flushPromises()
    const panel = wrapper.get('[data-review-kind="revision"]')
    await panel.get('.button--primary').trigger('click'); await flushPromises()

    expect(statuses()).toEqual(['PENDING'])
    expect(wrapper.findAll('.queue-summary strong').map(item => item.text())).toEqual(['1', '3', '1', '5'])
    await tab('APPROVED').trigger('click'); await flushPromises()
    expect(statuses()).toEqual(['APPROVED', 'APPROVED', 'APPROVED'])
    expect(wrapper.text()).toContain('Revision r-pending')
  })

  it('moves a rejected revision into Rejected and keeps its reason inspectable', async () => {
    api.rejectRevision.mockImplementation(async (id, reviewNote) => {
      revisions = revisions.map(item => item.id === id ? { ...item, status: 'REJECTED', reviewNote, reviewerUsername: 'admin', reviewedAt: '2026-09-28T01:00:00Z' } : item)
      return revisions.find(item => item.id === id)
    })
    wrapper = mount(AdminRequestPanel)
    await flushPromises()
    const panel = wrapper.get('[data-review-kind="revision"]')
    await panel.get('textarea').setValue('เอกสารไม่ตรงกับรายวิชา')
    const reject = panel.findAll('button').find(item => item.text() === 'ปฏิเสธ')
    await reject.trigger('click'); await flushPromises()

    expect(wrapper.findAll('.queue-summary strong').map(item => item.text())).toEqual(['1', '2', '2', '5'])
    await tab('REJECTED').trigger('click'); await flushPromises()
    expect(statuses()).toEqual(['REJECTED', 'REJECTED'])
    expect(wrapper.text()).toContain('เอกสารไม่ตรงกับรายวิชา')
    expect(wrapper.text()).toContain('@admin')
  })
})
