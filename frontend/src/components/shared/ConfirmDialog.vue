<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps({ open: { type: Boolean, default: false }, title: { type: String, required: true }, description: { type: String, default: '' }, confirmLabel: { type: String, default: 'ยืนยัน' }, danger: { type: Boolean, default: false }, busy: { type: Boolean, default: false } })
const emit = defineEmits(['confirm', 'cancel'])
const dialog = ref(null)
let previousFocus = null
function onKeydown(event) {
  if (event.key === 'Escape' && !props.busy) { emit('cancel'); return }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = [...dialog.value.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]')]
  if (!focusable.length) { event.preventDefault(); return }
  const first = focusable[0]; const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
watch(() => props.open, async (open) => {
  if (open) {
    previousFocus = document.activeElement
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    ;(dialog.value?.querySelector('textarea, input, button') || dialog.value)?.focus()
  } else {
    document.removeEventListener('keydown', onKeydown)
    previousFocus?.focus?.()
    previousFocus = null
  }
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>
<template><Teleport to="body"><Transition name="dialog"><div v-if="open" class="dialog-backdrop" @mousedown.self="!busy && $emit('cancel')"><section ref="dialog" class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" tabindex="-1"><p class="eyebrow">ยืนยันการดำเนินการ</p><h2 id="confirm-dialog-title">{{ title }}</h2><p id="confirm-dialog-description">{{ description }}</p><slot /><div class="dialog-actions"><button class="button button--ghost" type="button" :disabled="busy" @click="$emit('cancel')">ยกเลิก</button><button class="button" :class="danger ? 'button--danger' : 'button--primary'" type="button" :disabled="busy" @click="$emit('confirm')">{{ busy ? 'กำลังดำเนินการ…' : confirmLabel }}</button></div></section></div></Transition></Teleport></template>
