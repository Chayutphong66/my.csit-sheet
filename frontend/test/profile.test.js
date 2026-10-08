import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ profile: vi.fn(), star: vi.fn(), edit: vi.fn(), refresh: vi.fn() }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { username: 'owner' }, refresh: mocks.refresh }) }))
vi.mock('@/stores/notificationStore', () => ({ useNotificationStore: () => ({ items: [], load: vi.fn() }) }))
vi.mock('@/services/contributor.service', () => ({ contributorApi: mocks }))
import UserProfilePanel from '@/components/user/UserProfilePanel.vue'
const sheet = { id: 'same', title: 'Database notes', documentType: 'Sheet', courseId: 'db', courseCode: '101', courseName: 'Database', createdAt: new Date().toISOString(), starCount: 2, starredByMe: false }
const lecture = { ...sheet, title: 'Algorithms lecture', documentType: 'Lecture', courseId: 'algo', courseCode: '102', courseName: 'Algorithms' }
const fixture = () => ({ username: 'owner', displayName: 'Real owner', program: 'IT', cohort: '67', isOwner: true, badges: [], documents: [sheet, lecture].map(d => ({ ...d })), stars: [], requests: [{ id: 'private', title: 'Private request', fileName: 'notes.txt', documentType: 'Sheet', status: 'PENDING', createdAt: sheet.createdAt }], activity: [{ kind: 'Published', title: sheet.title, date: sheet.createdAt }] })
async function setup(tab) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/dashboard/profile', component: UserProfilePanel }] })
  await router.push({ path: '/dashboard/profile', query: tab ? { tab } : {} }); await router.isReady()
  const wrapper = mount(UserProfilePanel, { global: { plugins: [router] } }); await flushPromises()
  return { wrapper, router }
}
describe('document-focused Profile', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.profile.mockImplementation(async () => fixture()); mocks.star.mockResolvedValue({}) })
  it('uses real identity and routed tabs while preserving the sidebar and direct URLs', async () => {
    const { wrapper, router } = await setup()
    expect(wrapper.get('h1').text()).toBe('Real owner')
    expect(wrapper.text()).toContain('เทคโนโลยีสารสนเทศ (IT)')
    expect(wrapper.text()).toContain('รุ่น 67')
    expect(wrapper.find('nav').text()).toContain('Upload Requests')
    expect(wrapper.text()).not.toMatch(/Packages|Repositories/)
    expect(wrapper.text()).toContain('1 contributions in the last year')
    const sidebar = wrapper.get('aside').element
    await router.push('/dashboard/profile?tab=documents'); await flushPromises()
    expect(wrapper.get('[aria-current="page"]').text()).toContain('Documents')
    expect(wrapper.get('aside').element).toBe(sidebar)
    expect(mocks.profile).toHaveBeenCalledTimes(1)
    await wrapper.get('select').setValue('Lecture')
    expect(wrapper.findAll('.document-profile__row')).toHaveLength(1)
    expect(wrapper.text()).toContain('Algorithms lecture')
    expect(wrapper.text()).not.toContain('Database notes')
    await router.push('/dashboard/profile?tab=requests'); await flushPromises()
    expect(wrapper.text()).toContain('Private request')
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    router.back(); await new Promise(resolve => setTimeout(resolve, 0)); await flushPromises()
    expect(wrapper.get('[aria-current="page"]').text()).toContain('Documents')
    wrapper.unmount()
  })
  it('routes profile editing to dedicated settings without exposing account fields', async () => {
    const { wrapper } = await setup()
    const edit = wrapper.findAll('a').find(link => link.text() === 'Edit profile')
    expect(edit.attributes('href')).toBe('/dashboard/settings')
    expect(wrapper.findAll('aside select')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('อีเมลส่วนตัว')
    wrapper.unmount()
  })
  it('rolls back a failed optimistic Star and shows the action error', async () => {
    mocks.star.mockRejectedValueOnce(new Error('Cannot save Star'))
    const { wrapper } = await setup('documents')
    await wrapper.findAll('button').find(button => button.text() === '☆ Star').trigger('click'); await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Cannot save Star')
    expect(wrapper.findAll('button').some(button => button.text() === '★ Starred')).toBe(false)
    expect(mocks.star).toHaveBeenCalledWith(expect.objectContaining({ documentType: 'Sheet' }), true)
    wrapper.unmount()
  })
  it('removes an unstarred document and updates the count after the saved response', async () => {
    const saved = fixture(); saved.stars = [{ ...sheet, starredByMe: true }]
    mocks.profile.mockResolvedValueOnce(saved).mockResolvedValue(fixture())
    const { wrapper } = await setup('stars')
    await wrapper.findAll('button').find(button => button.text() === '★ Starred').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('No starred documents yet.')
    expect(wrapper.get('[aria-current="page"]').text()).toContain('0')
    wrapper.unmount()
  })
})
