import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ collections: vi.fn(), createCollection: vi.fn(), updateCollection: vi.fn(), createBulkUpload: vi.fn(), retryBulkUpload: vi.fn(), metadata: vi.fn() }))
vi.mock('@/services/admin.service', () => ({ adminApi: mocks }))
vi.mock('@/services/sheet.service', () => ({ sheetApi: { metadata: mocks.metadata } }))
import AdminCollectionPanel from '@/components/admin/AdminCollectionPanel.vue'

const collection = { id: 'collection-1', name: 'Algorithms', description: '', status: 'ACTIVE', documentCount: 0 }

describe('Collection management and bulk upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.collections.mockResolvedValue([{ ...collection }])
    mocks.metadata.mockResolvedValue({ programs: [], courses: [], academicYears: [], semesters: ['1', '2'], documentTypes: ['Lecture', 'Sheet'] })
    mocks.createCollection.mockResolvedValue({ ...collection, id: 'collection-2', name: 'Databases' })
    mocks.updateCollection.mockResolvedValue({ ...collection, status: 'ARCHIVED' })
  })

  it('creates and archives collections without exposing a destructive delete action', async () => {
    const wrapper = mount(AdminCollectionPanel)
    await flushPromises()
    expect(wrapper.text()).toContain('Algorithms')
    expect(wrapper.findAll('button').some(button => /ลบ/.test(button.text()))).toBe(false)
    await wrapper.get('input').setValue('Databases')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.createCollection).toHaveBeenCalledWith({ name: 'Databases', description: '' })
    const archive = wrapper.findAll('button').find(button => button.text() === 'เก็บถาวร')
    await archive.trigger('click')
    await flushPromises()
    expect(mocks.updateCollection).toHaveBeenCalledWith('collection-2', { status: 'ARCHIVED' })
  })

  it('renders explicit per-item status and a retry action only for failed items', async () => {
    const wrapper = mount(AdminCollectionPanel)
    await flushPromises()
    wrapper.vm.job = { id: 'job-1', status: 'PARTIAL', succeededItems: 1, failedItems: 1, items: [
      { id: 'a', clientKey: 'ok', status: 'READY' }, { id: 'b', clientKey: 'bad', status: 'FAILED', errorMessage: 'Invalid file' }
    ] }
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-bulk-status="READY"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-bulk-status="FAILED"]')).toHaveLength(1)
    expect(wrapper.findAll('button').filter(button => button.text() === 'ลองใหม่')).toHaveLength(1)
  })
})
