import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DocumentImpactActions from '@/components/user/DocumentImpactActions.vue'

describe('Document contributor impact', () => {
  it('shows contributor analytics and an obvious active Helpful state', async () => {
    const wrapper = mount(DocumentImpactActions, {
      props: {
        document: {
          uploaderUsername: 'user1', viewCount: 12, downloadCount: 7,
          helpfulCount: 3, helpfulByMe: true
        }
      }
    })
    expect(wrapper.text()).toContain('แบ่งปันโดย')
    expect(wrapper.text()).toContain('@user1')
    expect(wrapper.text()).toContain('12 ครั้งที่ดู')
    expect(wrapper.text()).toContain('7 ดาวน์โหลด')
    expect(wrapper.text()).toContain('3 มีประโยชน์')
    expect(wrapper.get('[aria-pressed="true"]').text()).toContain('มีประโยชน์')
    await wrapper.get('[aria-pressed="true"]').trigger('click')
    expect(wrapper.emitted('helpful')).toHaveLength(1)
  })
})
