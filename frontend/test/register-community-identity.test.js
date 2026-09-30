import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ register: vi.fn(), push: vi.fn() }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ loading: false, error: '', register: mocks.register }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))

import RegisterView from '@/views/auth/RegisterView.vue'
import { cohortOptions } from '@/services/communityIdentity'

describe('Register community identity', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.register.mockResolvedValue({ message: 'created' }) })

  it('uses required controlled Program and dynamically generated Cohort selects', async () => {
    const wrapper = mount(RegisterView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    const selects = wrapper.findAll('select')
    expect(selects).toHaveLength(2)
    expect(selects.every(select => select.attributes('required') !== undefined)).toBe(true)
    expect(selects[0].findAll('option').map(option => option.attributes('value'))).toEqual(['', 'CS', 'IT'])
    expect(selects[1].findAll('option').slice(1).map(option => option.attributes('value'))).toEqual(cohortOptions())

    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('Student Name')
    await inputs[1].setValue('student99')
    await inputs[2].setValue('student99@example.com')
    await inputs[3].setValue('CorrectHorse123')
    await selects[0].setValue('IT')
    await selects[1].setValue('69')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({ program: 'IT', cohort: '69' }))
  })

  it('adds cohort 70 without source changes when the Gregorian year reaches 2027', () => {
    expect(cohortOptions(new Date('2026-06-01T00:00:00Z'))).toEqual(['66', '67', '68', '69'])
    expect(cohortOptions(new Date('2027-06-01T00:00:00Z'))).toEqual(['66', '67', '68', '69', '70'])
  })
})
