<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({ file: { type: File, required: true }, busy: Boolean })
const emit = defineEmits(['save', 'cancel', 'error'])
const SIZE = 320
const canvas = ref(null)
const zoom = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const ready = ref(false)
const dragging = ref(false)
const image = new Image()
let objectUrl = ''
let dragStart = null

const instructions = computed(() => ready.value
  ? 'ลากรูปเพื่อจัดตำแหน่ง ใช้ลูกศรบนแป้นพิมพ์เพื่อขยับ และปรับซูมตามต้องการ'
  : 'กำลังเตรียมรูปภาพ…')

function dimensions() {
  const base = Math.max(SIZE / image.naturalWidth, SIZE / image.naturalHeight)
  const scale = base * Number(zoom.value)
  return { width: image.naturalWidth * scale, height: image.naturalHeight * scale }
}

function clampOffsets() {
  if (!ready.value) return
  const { width, height } = dimensions()
  const maxX = Math.max(0, (width - SIZE) / 2)
  const maxY = Math.max(0, (height - SIZE) / 2)
  offsetX.value = Math.max(-maxX, Math.min(maxX, Number(offsetX.value)))
  offsetY.value = Math.max(-maxY, Math.min(maxY, Number(offsetY.value)))
}

function draw() {
  const context = canvas.value?.getContext('2d')
  if (!context || !ready.value) return
  clampOffsets()
  const { width, height } = dimensions()
  context.clearRect(0, 0, SIZE, SIZE)
  context.drawImage(image, (SIZE - width) / 2 + offsetX.value, (SIZE - height) / 2 + offsetY.value, width, height)
}

watch([zoom, offsetX, offsetY], draw)

function reset() {
  zoom.value = 1
  offsetX.value = 0
  offsetY.value = 0
  draw()
}

function moveBy(x, y) {
  offsetX.value += x
  offsetY.value += y
}

function onKeydown(event) {
  const step = event.shiftKey ? 10 : 2
  const movement = {
    ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step]
  }[event.key]
  if (!movement) return
  event.preventDefault()
  moveBy(...movement)
}

function startDrag(event) {
  if (!ready.value || props.busy) return
  dragging.value = true
  dragStart = { x: event.clientX, y: event.clientY, offsetX: offsetX.value, offsetY: offsetY.value }
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function drag(event) {
  if (!dragging.value || !dragStart) return
  offsetX.value = dragStart.offsetX + event.clientX - dragStart.x
  offsetY.value = dragStart.offsetY + event.clientY - dragStart.y
}

function stopDrag(event) {
  if (!dragging.value) return
  dragging.value = false
  dragStart = null
  event.currentTarget.releasePointerCapture?.(event.pointerId)
}

function save() {
  const output = canvas.value
  if (!output || !ready.value) return emit('error', 'รูปภาพยังไม่พร้อม กรุณาลองอีกครั้ง')
  output.toBlob((blob) => {
    if (!blob) return emit('error', 'ไม่สามารถสร้างรูปโปรไฟล์จากพื้นที่ครอปนี้ได้')
    const reader = new FileReader()
    reader.onload = () => emit('save', String(reader.result))
    reader.onerror = () => emit('error', 'ไม่สามารถอ่านรูปโปรไฟล์ที่ครอปแล้วได้')
    reader.readAsDataURL(blob)
  }, 'image/png')
}

onMounted(() => {
  objectUrl = URL.createObjectURL(props.file)
  image.onload = async () => {
    if (!image.naturalWidth || !image.naturalHeight) return emit('error', 'รูปภาพไม่มีขนาดที่ถูกต้อง')
    ready.value = true
    await nextTick()
    draw()
  }
  image.onerror = () => emit('error', 'ไม่สามารถแสดงตัวอย่างรูปภาพนี้ได้ กรุณาเลือกไฟล์ใหม่')
  image.src = objectUrl
})

onBeforeUnmount(() => {
  image.onload = null
  image.onerror = null
  if (objectUrl) URL.revokeObjectURL(objectUrl)
})
</script>

<template>
  <div class="avatar-editor" role="dialog" aria-modal="true" aria-labelledby="avatar-editor-title">
    <div><h2 id="avatar-editor-title">ครอปรูปโปรไฟล์</h2><p id="avatar-editor-instructions" class="section-copy">{{ instructions }}</p></div>
    <div class="avatar-editor__stage" :class="{ 'is-dragging': dragging }">
      <canvas ref="canvas" width="320" height="320" class="avatar-editor__preview" tabindex="0" role="img" aria-label="ตัวอย่างรูปโปรไฟล์ทรงกลม กดปุ่มลูกศรเพื่อขยับรูป" aria-describedby="avatar-editor-instructions" @keydown="onKeydown" @pointerdown="startDrag" @pointermove="drag" @pointerup="stopDrag" @pointercancel="stopDrag" />
      <span v-if="!ready" class="avatar-editor__loading" role="status">กำลังโหลด…</span>
    </div>
    <label class="avatar-editor__zoom"><span>ซูม <output>{{ Number(zoom).toFixed(2) }}×</output></span><input v-model.number="zoom" type="range" min="1" max="3" step="0.05" :disabled="!ready || busy" /></label>
    <div class="avatar-editor__move-controls" aria-label="ขยับรูปภาพ">
      <button type="button" class="button button--ghost button--small" :disabled="!ready || busy" aria-label="ขยับรูปขึ้น" @click="moveBy(0, 10)">↑</button>
      <button type="button" class="button button--ghost button--small" :disabled="!ready || busy" aria-label="ขยับรูปไปทางซ้าย" @click="moveBy(10, 0)">←</button>
      <button type="button" class="button button--ghost button--small" :disabled="!ready || busy" aria-label="ขยับรูปลง" @click="moveBy(0, -10)">↓</button>
      <button type="button" class="button button--ghost button--small" :disabled="!ready || busy" aria-label="ขยับรูปไปทางขวา" @click="moveBy(-10, 0)">→</button>
    </div>
    <div class="table-actions"><button type="button" class="button button--ghost" :disabled="!ready || busy" @click="reset">รีเซ็ต</button><button type="button" class="button button--primary" :disabled="!ready || busy" @click="save">บันทึกรูป</button><button type="button" class="button button--ghost" :disabled="busy" @click="$emit('cancel')">ยกเลิก</button></div>
  </div>
</template>
