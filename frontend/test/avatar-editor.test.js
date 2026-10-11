import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AvatarEditor from '@/components/user/profile/AvatarEditor.vue'

let imageInstance
const drawImage = vi.fn()

class ReadyImage {
  constructor() {
    imageInstance = this
    this.naturalWidth = 640
    this.naturalHeight = 480
  }
  set src(value) {
    this._src = value
    queueMicrotask(() => this.onload?.())
  }
  get src() { return this._src }
}

describe('Avatar editor', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', ReadyImage)
    vi.stubGlobal('FileReader', class ReadyFileReader {
      readAsDataURL() {
        this.result = 'data:image/png;base64,cG5n'
        queueMicrotask(() => this.onload?.())
      }
    })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:avatar'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), drawImage })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['png'], { type: 'image/png' })))
    drawImage.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows a bounded circular crop with pointer and keyboard controls', async () => {
    const wrapper = mount(AvatarEditor, { props: { file: new File(['avatar'], 'avatar.png', { type: 'image/png' }) } })
    await flushPromises()
    expect(imageInstance.src).toBe('blob:avatar')
    expect(wrapper.text()).toContain('ลากรูปเพื่อจัดตำแหน่ง')
    expect(wrapper.find('.avatar-editor__loading').exists()).toBe(false)
    expect(drawImage).toHaveBeenCalled()

    const canvas = wrapper.get('canvas')
    await canvas.trigger('keydown', { key: 'ArrowLeft' })
    await canvas.trigger('pointerdown', { clientX: 20, clientY: 20, pointerId: 1 })
    await canvas.trigger('pointermove', { clientX: 35, clientY: 30, pointerId: 1 })
    await canvas.trigger('pointerup', { clientX: 35, clientY: 30, pointerId: 1 })
    expect(drawImage.mock.calls.length).toBeGreaterThan(1)
    expect(wrapper.findAll('.avatar-editor__move-controls button')).toHaveLength(4)
    wrapper.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar')
  })

  it('exports PNG so transparent avatars are not flattened onto black JPEG', async () => {
    const wrapper = mount(AvatarEditor, { props: { file: new File(['avatar'], 'avatar.png', { type: 'image/png' }) } })
    await flushPromises()
    await wrapper.get('button.button--primary').trigger('click')
    await flushPromises()
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('reports export failures instead of replacing the existing avatar', async () => {
    HTMLCanvasElement.prototype.toBlob.mockImplementationOnce(callback => callback(null))
    const wrapper = mount(AvatarEditor, { props: { file: new File(['avatar'], 'avatar.png', { type: 'image/png' }) } })
    await flushPromises()
    await wrapper.get('button.button--primary').trigger('click')
    expect(wrapper.emitted('error')?.[0]?.[0]).toContain('ไม่สามารถสร้างรูปโปรไฟล์')
    expect(wrapper.emitted('save')).toBeUndefined()
  })
})
