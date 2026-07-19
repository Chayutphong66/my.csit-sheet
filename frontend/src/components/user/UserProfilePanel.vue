<script setup>
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
</script>

<template>
  <section class="page-panel">
    <p class="eyebrow">User</p>
    <h1>Profile</h1>
    <div class="profile-grid">
      <span>Username</span>
      <strong>{{ auth.user?.username }}</strong>
      <span>Email</span>
      <strong>{{ auth.user?.email }}</strong>
      <span>Role</span>
      <strong>{{ auth.user?.role }}</strong>
    </div>
  </section>
</template>
