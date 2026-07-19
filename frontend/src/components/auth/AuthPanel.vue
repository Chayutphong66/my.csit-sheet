<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  error: { type: String, default: '' }
})
</script>

<template>
  <main class="auth-page">
    <RouterLink to="/" class="brand">
      <span class="brand__mark">CS</span>
      <span>CSIT Sheet</span>
    </RouterLink>
    <section class="auth-card">
      <p class="eyebrow">Naresuan University</p>
      <h1>{{ title }}</h1>
      <p>{{ subtitle }}</p>
      <p v-if="error" class="form-error">{{ error }}</p>
      <slot />
    </section>
  </main>
</template>
