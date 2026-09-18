import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  adminUploadRequests: vi.fn(), adminDownloadUploadRequestFile: vi.fn(),
  approveUploadRequest: vi.fn(), publicDocumentFile: vi.fn()
}))
vi.mock('@/services/admin.service', () => ({ adminApi: api }))
vi.mock('@/services/document.service', () => ({ downloadDocumentBlob: vi.fn(), openDocumentBlob: vi.fn() }))
import AdminRequestPanel from '@/components/admin/AdminRequestPanel.vue'

const row = (id) => ({ id, title: id, fileName: `${id}.pdf`, username: 'user1', documentType: 'Sheet', status: 'PENDING', duplicateStatus: 'NONE', duplicateMatches: [] })
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done }); return { promise, resolve } }
const button = (wrapper, text) => wrapper.findAll('button').find((item) => item.text() === text)
let wrapper
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('URL', { createObjectURL: vi.fn((blob) => `blob:${blob.name}`), revokeObjectURL: vi.fn() })
})
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })

describe('Admin review safety', () => {
  it('keeps preview and metadata together when requests finish out of order', async () => {
    api.adminUploadRequests.mockResolvedValue([row('A'), row('B')])
    api.adminDownloadUploadRequestFile.mockResolvedValueOnce({ name: 'initial' })
    wrapper = mount(AdminRequestPanel)
    await flushPromises()
    const slow = deferred(); const fast = deferred()
    api.adminDownloadUploadRequestFile.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise)
    await button(wrapper, 'กำลังตรวจรายการนี้').trigger('click')
    await button(wrapper, 'ตรวจสอบ →').trigger('click')
    fast.resolve({ name: 'B' }); await flushPromises()
    slow.resolve({ name: 'A' }); await flushPromises()
    expect(wrapper.get('iframe').attributes('src')).toBe('blob:B')
    expect(wrapper.get('iframe').attributes('title')).toBe('ตัวอย่าง B.pdf')
    expect(URL.createObjectURL).not.toHaveBeenCalledWith({ name: 'A' })
  })

  it('confirms publication before invoking the API, then reports success', async () => {
    api.adminUploadRequests.mockResolvedValueOnce([row('A')]).mockResolvedValueOnce([])
    api.adminDownloadUploadRequestFile.mockResolvedValue({ name: 'A' })
    api.approveUploadRequest.mockResolvedValue({})
    wrapper = mount(AdminRequestPanel, { global: { stubs: { teleport: true } } })
    await flushPromises()
    await button(wrapper, 'อนุมัติและเผยแพร่').trigger('click')
    expect(api.approveUploadRequest).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alertdialog"]').text()).toContain('อนุมัติและเผยแพร่เอกสารนี้?')
    expect(wrapper.find('textarea').exists()).toBe(false)
    await button(wrapper, 'ยืนยันการเผยแพร่').trigger('click')
    await flushPromises()
    expect(api.approveUploadRequest).toHaveBeenCalledExactlyOnceWith('A', {})
    expect(wrapper.get('[role="status"]').text()).toContain('อนุมัติและเผยแพร่เอกสารแล้ว')
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:A')
  })

  it('opens pending duplicate evidence through the admin file endpoint', async () => {
    api.adminUploadRequests.mockResolvedValue([{ ...row('A'), duplicateStatus: 'EXACT_DUPLICATE', duplicateMatches: [{ ...row('B'), source: 'REQUEST', matchType: 'EXACT_DUPLICATE', binaryMatch: true }] }])
    api.adminDownloadUploadRequestFile.mockResolvedValue({ name: 'file' })
    wrapper = mount(AdminRequestPanel)
    await flushPromises()
    await button(wrapper, 'ดูรายการเดิม').trigger('click')
    await flushPromises()
    expect(api.adminDownloadUploadRequestFile).toHaveBeenLastCalledWith('B')
    expect(api.publicDocumentFile).not.toHaveBeenCalled()
  })
})
