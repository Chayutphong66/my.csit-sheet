import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  route: { params: { slug: 'ordered-pack', type: 'lecture', documentId: 'lecture-1' } },
  push: vi.fn(), replace: vi.fn(), published: vi.fn(), readerFile: vi.fn()
}))
vi.mock('vue-router', () => ({ useRoute: () => state.route, useRouter: () => ({ push: state.push, replace: state.replace }) }))
vi.mock('@/services/collection.service', () => ({ collectionApi: { published: state.published, readerFile: state.readerFile } }))
import CollectionReaderPanel from '@/components/user/CollectionReaderPanel.vue'
enableAutoUnmount(afterEach)

const collection = {
  slug: 'ordered-pack', name: 'Ordered pack', publicationStatus: 'PUBLISHED', visibility: 'AUTHENTICATED',
  unsectioned: [{ documentType: 'Sheet', documentId: 'sheet-0', title: 'Overview', courseCode: 'CS100', courseName: 'Basics', uploaderUsername: 'owner' }],
  sections: [
    { id: 'section-a', title: 'Foundations', position: 0, documents: [{ documentType: 'Lecture', documentId: 'lecture-1', title: 'First lecture', courseCode: 'CS101', courseName: 'Algorithms', uploaderUsername: 'owner' }] },
    { id: 'section-b', title: 'Practice', position: 1, documents: [{ documentType: 'Sheet', documentId: 'sheet-2', title: 'Final sheet', courseCode: 'CS101', courseName: 'Algorithms', uploaderUsername: 'owner' }] }
  ]
}
const RouterLink = { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }

describe('Phase 5 Collection Reader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.route.params = { slug: 'ordered-pack', type: 'lecture', documentId: 'lecture-1' }
    state.published.mockResolvedValue(structuredClone(collection))
    state.readerFile.mockResolvedValue({ blob: new Blob(['%PDF'], { type: 'application/pdf' }), contentType: 'application/pdf' })
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:reader-file'), revokeObjectURL: vi.fn() })
  })

  it('renders ordered sections, document metadata, PDF, and Previous/Next controls', async () => {
    const wrapper = mount(CollectionReaderPanel, { global: { stubs: { RouterLink } } })
    await flushPromises()
    expect(wrapper.text()).toContain('Foundations')
    expect(wrapper.text()).toContain('First lecture')
    expect(wrapper.text()).toContain('Lecture')
    expect(wrapper.text()).toContain('CS101')
    expect(wrapper.find('iframe[title="เอกสาร PDF: First lecture"]').attributes('src')).toBe('blob:reader-file')
    expect(wrapper.text()).toContain('Overview')
    expect(wrapper.text()).toContain('Final sheet')
    expect(wrapper.text()).toContain('2 / 3')
    expect(state.readerFile).toHaveBeenCalledWith('ordered-pack', expect.objectContaining({ documentId: 'lecture-1' }))
  })

  it('supports keyboard navigation without hijacking form controls', async () => {
    const wrapper = mount(CollectionReaderPanel, { attachTo: document.body, global: { stubs: { RouterLink } } })
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(state.push).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ documentId: 'sheet-2' }) }))
    const input = document.createElement('input'); document.body.appendChild(input); input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(state.push).toHaveBeenCalledTimes(1)
    input.remove(); wrapper.unmount()
  })

  it('shows safe file and empty Collection states', async () => {
    state.readerFile.mockRejectedValueOnce(new Error('Document file unavailable'))
    let wrapper = mount(CollectionReaderPanel, { global: { stubs: { RouterLink } } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Document file unavailable')
    wrapper.unmount()
    state.published.mockResolvedValueOnce({ ...collection, sections: [], unsectioned: [] })
    wrapper = mount(CollectionReaderPanel, { global: { stubs: { RouterLink } } })
    await flushPromises()
    expect(wrapper.text()).toContain('ยังไม่มีเอกสารที่พร้อมอ่าน')
  })

  it('does not request a stale document file after visibility changes', async () => {
    state.published.mockResolvedValueOnce({ ...collection, sections: collection.sections.map(section => ({ ...section, documents: [] })), unsectioned: collection.unsectioned })
    const wrapper = mount(CollectionReaderPanel, { global: { stubs: { RouterLink } } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('ไม่ได้อยู่ใน Collection นี้แล้ว')
    expect(state.readerFile).not.toHaveBeenCalled()
  })

  it('keeps a responsive landmark structure for narrow screens', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    const wrapper = mount(CollectionReaderPanel, { global: { stubs: { RouterLink } } })
    await flushPromises()
    expect(wrapper.find('.reader-layout').exists()).toBe(true)
    expect(wrapper.find('aside.reader-toc nav[aria-label="สารบัญ Collection"]').exists()).toBe(true)
    expect(wrapper.find('nav.reader-pager[aria-label="เปลี่ยนเอกสาร"]').exists()).toBe(true)
    expect(wrapper.get('h1[tabindex="-1"]').text()).toBe('First lecture')
  })

  it('revokes the private Blob URL when the Reader is closed', async () => {
    const wrapper = mount(CollectionReaderPanel, { global: { stubs: { RouterLink } } })
    await flushPromises()
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:reader-file')
  })
})
