<script setup>
import AppNavbar from '@/components/layout/AppNavbar.vue'

const features = [
  { title: 'Separate catalogs', body: 'Lecture files and summary sheets stay distinct, searchable, and easy to understand.' },
  { title: 'Reviewed uploads', body: 'Students submit material with course metadata and track every approval decision.' },
  { title: 'Admin workflow', body: 'Moderators review pending uploads, publish approved files, and keep the library trustworthy.' }
]

const steps = ['Find a course', 'Open a file', 'Download material', 'Upload your notes']
</script>

<template>
  <div>
    <AppNavbar />

    <section class="hero">
      <div class="hero__content">
        <p class="eyebrow">CSIT Learning Materials</p>
        <h1>Find what you need to study.</h1>
        <p class="hero__lead">
          CSIT Sheet brings lecture files, revision sheets, and student-made summaries into one polished academic workspace.
        </p>
        <div class="hero__actions">
          <RouterLink to="/login" class="button button--primary">Start studying</RouterLink>
          <button class="button button--ghost" type="button" @click="document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })">
            Explore features
          </button>
        </div>
      </div>

      <div class="hero__visual" aria-hidden="true">
        <img src="@/assets/E7611BAA-F118-4199-88FA-7E6E2663C62B.png" alt="" />
      </div>
    </section>

    <section id="features" class="section">
      <div class="section-heading">
        <p class="eyebrow">Product</p>
        <h2>A quiet, reliable library for the materials students actually use.</h2>
      </div>
      <div class="feature-grid">
        <article v-for="feature in features" :key="feature.title" class="feature-card">
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.body }}</p>
        </article>
      </div>
    </section>

    <section id="workflow" class="section section--muted">
      <div class="section-heading">
        <p class="eyebrow">Workflow</p>
        <h2>From search to download in seconds.</h2>
      </div>
      <div class="step-list">
        <div v-for="(step, index) in steps" :key="step" class="step-item">
          <span>{{ index + 1 }}</span>
          <strong>{{ step }}</strong>
        </div>
      </div>
    </section>

    <footer id="contact" class="footer">
      <strong>CSIT Sheet</strong>
      <span>Learning-material platform for CSIT students.</span>
    </footer>
  </div>
</template>
