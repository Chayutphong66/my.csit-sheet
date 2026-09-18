<script setup>
import { computed } from 'vue'
const props = defineProps({ activity: { type: Array, default: () => [] } })
const days = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(today); start.setDate(start.getDate() - 364)
  const counts = new Map()
  for (const event of props.activity) {
    const parsed = new Date(event.date.includes('T') ? event.date : `${event.date.replace(' ', 'T')}Z`)
    const key = parsed.toLocaleDateString('en-CA'); counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...Array(start.getDay()).fill(null), ...Array.from({ length: 365 }, (_, index) => {
    const date = new Date(start); date.setDate(start.getDate() + index)
    const count = counts.get(date.toLocaleDateString('en-CA')) || 0
    return { date, count, level: count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4 }
  })]
})
const total = computed(() => days.value.reduce((sum, day) => sum + (day?.count || 0), 0))
const months = computed(() => days.value.flatMap((day, index) => day && (day.date.getDate() === 1 || index === days.value.findIndex(Boolean)) ? [{ label: day.date.toLocaleDateString('en', { month: 'short' }), column: Math.floor(index / 7) + 1 }] : []))
</script>
<template>
  <section class="document-profile__contributions"><h2>{{ total }} contributions in the last year</h2><p class="material-meta">นับการอัปโหลดของคุณ การเผยแพร่ และการแก้ไขเอกสารสาธารณะ ไม่รวมยอดดู</p>
    <div class="document-profile__graph-scroll" tabindex="0" aria-label="Contribution calendar: scroll horizontally to see the full year"><div class="document-profile__calendar"><div class="document-profile__weekdays" aria-hidden="true"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div><div><div class="document-profile__months"><span v-for="month in months" :key="month.column" :style="{ gridColumn: month.column }">{{ month.label }}</span></div><div class="document-profile__graph" role="list" aria-label="Daily contributions"><span v-for="(day, index) in days" :key="index" class="document-profile__day" :class="day ? `document-profile__day--${day.level}` : 'document-profile__day--blank'" :title="day ? `${day.date.toLocaleDateString('th-TH')}: ${day.count} contributions` : undefined" :role="day ? 'listitem' : undefined" :aria-label="day ? `${day.date.toLocaleDateString('th-TH')}: ${day.count} contributions` : undefined" :aria-hidden="!day" /></div></div></div></div>
    <div class="document-profile__legend"><span>Less</span><span v-for="level in [0, 1, 2, 3, 4]" :key="level" class="document-profile__day" :class="`document-profile__day--${level}`" :title="['0', '1', '2–3', '4–5', '6+'][level] + ' activities'" /><span>More</span></div>
  </section>
</template>
