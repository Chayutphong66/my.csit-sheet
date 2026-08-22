<script setup>
const props = defineProps({
  status: { type: String, required: true }
})

const normalSteps = [
  { key: 'PENDING', label: 'Request Sent', hint: 'Waiting for Admin' },
  { key: 'APPROVED', label: 'Admin Approved', hint: 'Ready to continue' },
  { key: 'PROCESSING', label: 'Processing', hint: 'Document information confirmed' },
  { key: 'COMPLETED', label: 'Completed', hint: 'Available in resources' }
]

const rejectedSteps = [
  { key: 'PENDING', label: 'Request Sent', hint: 'Waiting for Admin' },
  { key: 'REJECTED', label: 'Rejected', hint: 'Admin reviewed the request' }
]

const rank = { PENDING: 0, APPROVED: 1, PROCESSING: 2, COMPLETED: 3, FAILED: 3 }

function stepState(step) {
  const status = props.status?.toUpperCase()
  if (status === 'REJECTED' && step.key === 'REJECTED') return 'rejected'
  if (status === 'FAILED' && step.key === 'COMPLETED') return 'rejected'
  if (step.key === status) return 'active'
  return rank[step.key] < rank[status] ? 'done' : 'future'
}
</script>

<template>
  <ol class="timeline" :class="{ 'timeline--rejected': status === 'REJECTED' }">
    <li
      v-for="step in status === 'REJECTED' ? rejectedSteps : normalSteps"
      :key="step.key"
      class="timeline__step"
      :class="`timeline__step--${stepState(step)}`"
    >
      <span class="timeline__dot" aria-hidden="true"></span>
      <span class="timeline__text">
        <strong>{{ step.label }}</strong>
        <small>{{ step.hint }}</small>
      </span>
    </li>
  </ol>
</template>
