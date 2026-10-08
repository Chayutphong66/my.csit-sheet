<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps({ file: { type: File, required: true }, busy: Boolean }); const emit = defineEmits(['save','cancel'])
const canvas = ref(); const image = new Image(); const zoom = ref(1); const offsetX = ref(0); const offsetY = ref(0); let objectUrl = ''
function draw() { const ctx = canvas.value?.getContext('2d'); if (!ctx || !image.width) return; const size = 320; ctx.clearRect(0,0,size,size); const base = Math.max(size/image.width,size/image.height); const scale = base * zoom.value; const w=image.width*scale,h=image.height*scale; ctx.drawImage(image,(size-w)/2+Number(offsetX.value),(size-h)/2+Number(offsetY.value),w,h) }
watch([zoom,offsetX,offsetY], draw)
objectUrl = URL.createObjectURL(props.file); image.onload = draw; image.src = objectUrl
function save() { canvas.value.toBlob(blob => { const reader = new FileReader(); reader.onload = () => emit('save', reader.result); reader.readAsDataURL(blob) }, 'image/jpeg', .86) }
onBeforeUnmount(() => URL.revokeObjectURL(objectUrl))
</script>
<template><div class="avatar-editor" role="dialog" aria-modal="true" aria-label="Crop profile picture"><canvas ref="canvas" width="320" height="320" class="avatar-editor__preview" /><label>Zoom<input v-model="zoom" type="range" min="1" max="3" step="0.05" /></label><label>แนวนอน<input v-model="offsetX" type="range" min="-140" max="140" /></label><label>แนวตั้ง<input v-model="offsetY" type="range" min="-140" max="140" /></label><div class="table-actions"><button class="button button--primary" :disabled="busy" @click="save">Save</button><button class="button button--ghost" :disabled="busy" @click="$emit('cancel')">Cancel</button></div></div></template>
