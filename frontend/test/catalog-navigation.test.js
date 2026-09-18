import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

const courses = vi.hoisted(() => vi.fn(async (type) => [{ id: type, code: type, name: `${type} course`, documentCount: 1 }]))
vi.mock('@/services/document.service', () => ({ documentApi: { courses } }))
import UserDashboardView from '@/views/user/UserDashboardView.vue'
import DocumentCatalogPanel from '@/components/user/DocumentCatalogPanel.vue'

describe('Typed catalog SPA navigation', () => {
  it('reloads reused catalog components and clears earlier search when switching type', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/dashboard', component: UserDashboardView, children: [
      { path: 'lec', component: DocumentCatalogPanel, props: { documentType: 'Lecture', basePath: '/dashboard/lec' } },
      { path: 'sheet', component: DocumentCatalogPanel, props: { documentType: 'Sheet', basePath: '/dashboard/sheet' } }
      , { path: ':type/:courseId', component: { template: '<div>Course</div>' } }
    ] }] })
    await router.push('/dashboard/lec'); await router.isReady()
    const wrapper = mount(UserDashboardView, { global: { plugins: [router], stubs: { DashboardShell: { template: '<div><slot /></div>' } } } })
    await flushPromises()
    expect(wrapper.text()).toContain('Lecture course')
    await wrapper.get('input').setValue('earlier query')
    await router.push('/dashboard/sheet'); await flushPromises()
    expect(courses).toHaveBeenLastCalledWith('Sheet')
    expect(wrapper.text()).toContain('Sheet course')
    expect(wrapper.text()).not.toContain('Lecture course')
    expect(wrapper.get('input').element.value).toBe('')
    wrapper.unmount()
  })
})
