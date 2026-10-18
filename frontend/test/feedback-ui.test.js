import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import UserFeedbackPanel from '@/components/user/UserFeedbackPanel.vue'
import AdminFeedbackPanel from '@/components/admin/AdminFeedbackPanel.vue'

const api = vi.hoisted(() => ({ submit: vi.fn(), mine: vi.fn(), detail: vi.fn(), adminList: vi.fn(), adminDetail: vi.fn(), adminUpdate: vi.fn() }))
vi.mock('@/services/feedback.service', () => ({ feedbackApi: api }))
const routerLink = { template: '<a><slot /></a>' }

describe('feedback UI', () => {
  beforeEach(() => vi.clearAllMocks())

  it('submits synthetic user feedback and displays the public reference/history', async () => {
    api.mine.mockResolvedValue({ items: [] })
    api.submit.mockResolvedValue({ reference: 'FB-0011223344556677', status: 'OPEN' })
    api.detail.mockResolvedValue({ reference: 'FB-0011223344556677', subject: 'Search is broken', description: 'Results disappear after filtering.', status: 'OPEN', events: [] })
    const wrapper = mount(UserFeedbackPanel, { global: { stubs: { RouterLink: routerLink } } })
    await flushPromises()
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('Search is broken')
    await wrapper.get('textarea').setValue('Results disappear after filtering.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.submit).toHaveBeenCalledWith(expect.objectContaining({ category: 'BUG', subject: 'Search is broken' }))
    expect(wrapper.text()).toContain('FB-0011223344556677')
  })

  it('labels internal/public review fields and sends optimistic version', async () => {
    const report = { reference: 'FB-AABBCCDDEEFF0011', category: 'BUG', subject: 'Broken link', description: 'A document link is not available.', status: 'OPEN', version: 3, reporter: { username: 'student' }, events: [] }
    api.adminList.mockResolvedValue({ items: [report], total: 1 })
    api.adminDetail.mockResolvedValue(report)
    api.adminUpdate.mockResolvedValue({ ...report, status: 'IN_REVIEW', version: 4 })
    const wrapper = mount(AdminFeedbackPanel)
    await flushPromises(); await wrapper.get('.feedback-card').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('Internal note')
    expect(wrapper.get('label[for="feedback-review-status"]').text()).toBe('เปลี่ยนสถานะ')
    expect(wrapper.get('#feedback-review-status').exists()).toBe(true)
    const textareas = wrapper.findAll('textarea')
    await textareas[0].setValue('Private triage context')
    await textareas[1].setValue('We are reviewing this issue.')
    await wrapper.find('.feedback-detail form').trigger('submit'); await flushPromises()
    expect(api.adminUpdate).toHaveBeenCalledWith('FB-AABBCCDDEEFF0011', expect.objectContaining({ expectedVersion: 3, internalNote: 'Private triage context', publicMessage: 'We are reviewing this issue.' }))
  })
})
