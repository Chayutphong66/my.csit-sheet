import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  adminUsers: vi.fn(), adminUser: vi.fn(), updateAdminUser: vi.fn(), updateAdminUserStatus: vi.fn()
}))
vi.mock('@/services/admin.service', () => ({ adminApi: mocks }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'admin-1', role: 'ADMIN' } }) }))
import AdminStatusPanel from '@/components/admin/AdminStatusPanel.vue'

const managed = {
  id: 'user-1', username: 'student1', displayName: 'Student One', email: 'student@example.test',
  role: 'USER', program: 'CS', cohort: '66', bio: '', profilePublic: true, showProgram: true,
  showCohort: true, isVerified: true, accountStatus: 'ACTIVE', lectureCount: 2, sheetCount: 1,
  uploadCount: 3, contributionCount: 1
}

function list(items = [managed]) {
  return { items, pagination: { page: 1, limit: 12, total: items.length, totalPages: 1 } }
}

describe('Admin user management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.adminUsers.mockResolvedValue(list())
    mocks.adminUser.mockResolvedValue({ user: managed, audit: [] })
    mocks.updateAdminUser.mockResolvedValue({ ...managed, displayName: 'Updated Student' })
    mocks.updateAdminUserStatus.mockResolvedValue({ ...managed, accountStatus: 'DEACTIVATED', deactivationReason: 'Security review' })
  })

  it('loads paginated users and applies search and status filters', async () => {
    const wrapper = mount(AdminStatusPanel)
    await flushPromises()
    expect(wrapper.text()).toContain('Student One')
    expect(wrapper.text()).toContain('student@example.test')
    await wrapper.get('input[type="search"]').setValue('student@example.test')
    await wrapper.get('.admin-user-filters select').setValue('ACTIVE')
    await wrapper.get('.admin-user-filters').trigger('submit')
    await flushPromises()
    expect(mocks.adminUsers).toHaveBeenLastCalledWith({ search: 'student@example.test', status: 'ACTIVE', page: 1, limit: 12 })
    expect(mocks.adminUser).toHaveBeenCalledWith('user-1')
  })

  it('edits only the exposed profile fields and refreshes audit details', async () => {
    const wrapper = mount(AdminStatusPanel)
    await flushPromises()
    await wrapper.get('.admin-user-edit input').setValue('Updated Student')
    await wrapper.get('.admin-user-edit').trigger('submit')
    await flushPromises()
    expect(mocks.updateAdminUser).toHaveBeenCalledWith('user-1', expect.objectContaining({
      displayName: 'Updated Student', program: 'CS', cohort: '66', profilePublic: true
    }))
    const payload = mocks.updateAdminUser.mock.calls[0][1]
    expect(payload).not.toHaveProperty('role')
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('password')
  })

  it('requires a reason before deactivation and disables self-deactivation', async () => {
    const wrapper = mount(AdminStatusPanel)
    await flushPromises()
    const button = wrapper.findAll('button').find(item => item.text().includes('ปิดใช้งานบัญชี'))
    expect(button.attributes('disabled')).toBeDefined()
    await wrapper.get('.admin-account-status textarea').setValue('Security review')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    await flushPromises()
    expect(mocks.updateAdminUserStatus).toHaveBeenCalledWith('user-1', 'DEACTIVATED', 'Security review')

    mocks.adminUsers.mockResolvedValue(list([{ ...managed, id: 'admin-1', role: 'ADMIN' }]))
    mocks.adminUser.mockResolvedValue({ user: { ...managed, id: 'admin-1', role: 'ADMIN' }, audit: [] })
    const selfWrapper = mount(AdminStatusPanel)
    await flushPromises()
    expect(selfWrapper.text()).toContain('ไม่สามารถปิดใช้งานบัญชีของตนเองได้')
    expect(selfWrapper.get('.admin-account-status textarea').attributes('disabled')).toBeDefined()
  })
})
