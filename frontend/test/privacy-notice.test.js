import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PrivacyNotice from '@/components/PrivacyNotice.vue'
import { PRIVACY_NOTICE_KEY, PRIVACY_NOTICE_VERSION, readPrivacyAcknowledgement } from '@/services/privacyNotice'

describe('privacy notice', () => {
  beforeEach(() => localStorage.clear())
  it('records a versioned acknowledgement and stops showing the notice', async () => {
    const wrapper = mount(PrivacyNotice, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    expect(wrapper.text()).toContain('การใช้ข้อมูลที่จำเป็น')
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('.privacy-notice').exists()).toBe(false)
    expect(JSON.parse(localStorage.getItem(PRIVACY_NOTICE_KEY)).version).toBe(PRIVACY_NOTICE_VERSION)
  })
  it('fails open when browser storage is unavailable', () => {
    const storage = { getItem() { throw new Error('blocked') } }
    expect(readPrivacyAcknowledgement(storage)).toBe(null)
  })
})
