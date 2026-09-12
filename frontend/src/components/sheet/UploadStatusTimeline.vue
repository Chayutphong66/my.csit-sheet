<script setup>
const props = defineProps({
  status: { type: String, required: true }
})

// The flow is now two steps: a request is sent (PENDING) and, once an admin approves it,
// it is immediately published (APPROVED) and visible to everyone. There is no separate
// user "complete" step anymore.
const normalSteps = [
  { key: 'PENDING', label: 'Request Sent', hint: 'Waiting for admin' },
  { key: 'APPROVED', label: 'Approved & Published', hint: 'Visible to everyone' }
]

const rejectedSteps = [
  { key: 'PENDING', label: 'Request Sent', hint: 'Waiting for admin' },
  { key: 'REJECTED', label: 'Rejected', hint: 'Admin reviewed the request' }
]

const rank = { PENDING: 0, APPROVED: 1 }

// Legacy/intermediate statuses from the old multi-step flow collapse onto "published".
function normalizeStatus(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'PROCESSING' || value === 'COMPLETED') return 'APPROVED'
  return value
}

function stepState(step) {
  const status = normalizeStatus(props.status)
  if (status === 'REJECTED' && step.key === 'REJECTED') return 'rejected'
  if (status === 'FAILED' && step.key === 'APPROVED') return 'rejected'
  if (step.key === status) return 'active'
  if (status === 'FAILED' && step.key === 'PENDING') return 'done'
  return rank[step.key] < rank[status] ? 'done' : 'future'
}
</script>

<template>
  <ol class="timeline" :class="{ 'timeline--rejected': normalizeStatus(status) === 'REJECTED' }">
    <li
      v-for="step in normalizeStatus(status) === 'REJECTED' ? rejectedSteps : normalSteps"
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
