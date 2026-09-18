<script setup>
import { nextTick, ref, watch } from 'vue'
import { sheetApi } from '@/services/sheet.service'
const props = defineProps({ open: Boolean, course: Object, program: Object, academicYear: String, semester: String })
const emit = defineEmits(['close', 'submitted'])
const name = ref(''); const note = ref(''); const loading = ref(false); const error = ref(''); const input = ref(null)
watch(() => props.open, async value => { if (value) { name.value = ''; note.value = ''; error.value = ''; await nextTick(); input.value?.focus() } })
async function submit() { loading.value = true; error.value = ''; try { const suggestion = await sheetApi.suggestTeacher({ teacherName: name.value, note: note.value, courseId: props.course.id, academicYear: props.academicYear, semester: props.semester }); emit('submitted', suggestion) } catch (caught) { error.value = caught.message } finally { loading.value = false } }
</script>
<template>
  <Teleport to="body"><div v-if="open" class="dialog-backdrop" @click.self="$emit('close')" @keydown.esc="$emit('close')"><section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="teacher-suggestion-title"><h2 id="teacher-suggestion-title">เสนอข้อมูลอาจารย์</h2><dl class="metadata-list"><div v-if="program"><dt>สาขา</dt><dd>{{ program.nameTh }}</dd></div><div><dt>รายวิชา</dt><dd>{{ course.code }} · {{ course.nameEn || course.name }}</dd></div><div><dt>ปีการศึกษา</dt><dd>{{ academicYear }}</dd></div><div><dt>ภาคเรียน</dt><dd>{{ semester }}</dd></div></dl><form class="form" @submit.prevent="submit"><label>ชื่ออาจารย์ *<input ref="input" v-model="name" required minlength="2" maxlength="120" autocomplete="off" /></label><label>รายละเอียดเพิ่มเติม<textarea v-model="note" maxlength="1000" rows="3" placeholder="เช่น ปีนี้เปลี่ยนผู้สอน หรือสอนร่วมกับอาจารย์เดิม" /></label><p v-if="error" class="form-error" role="alert">{{ error }}</p><div class="table-actions"><button class="button button--ghost" type="button" :disabled="loading" @click="$emit('close')">ยกเลิก</button><button class="button button--primary" :disabled="loading">{{ loading ? 'กำลังส่ง…' : 'ส่งข้อมูล' }}</button></div></form></section></div></Teleport>
</template>
