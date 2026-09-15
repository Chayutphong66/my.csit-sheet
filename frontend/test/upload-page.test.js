import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }))
import UserUploadPanel from '@/components/user/UserUploadPanel.vue'

describe('Upload page', () => {
  it('keeps the upload form and history in one Thai-first page', async () => {
    const wrapper = mount(UserUploadPanel, { global: { stubs: {
      DocumentUploadForm: { template: '<form data-test="upload-form" />' },
      UserRequestsPanel: { props: ['embedded'], template: '<div data-test="history">History</div>' }
    } } })
    expect(wrapper.get('[data-test="upload-form"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('การอัปโหลดของฉัน')
    const historyButton = wrapper.findAll('button').find((button) => button.text() === 'การอัปโหลดของฉัน')
    await historyButton.trigger('click')
    expect(wrapper.get('[data-test="history"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="upload-form"]').exists()).toBe(false)
  })
})
