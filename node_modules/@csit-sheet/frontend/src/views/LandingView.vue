<script setup>
import AppNavbar from '@/components/layout/AppNavbar.vue'

const features = [
  { title: 'ค้นหาชีทได้เร็ว', body: 'รวมชีทสรุปตามรายวิชา พร้อมสถานะตรวจสอบจากผู้ดูแลระบบ' },
  { title: 'อัปโหลดเป็นระบบ', body: 'นักศึกษาส่งชีทพร้อมรายละเอียดวิชา แล้วติดตามผลอนุมัติได้ใน Dashboard' },
  { title: 'เหมาะกับทีมแอดมิน', body: 'หน้า Admin แยกรายการรอตรวจ สถิติ และการอนุมัติไว้ชัดเจน' }
]

const steps = ['อัปโหลดชีท', 'กรอกรายละเอียด', 'รอตรวจสอบ', 'เผยแพร่ให้ดาวน์โหลด']
</script>

<template>
  <div>
    <AppNavbar />

    <section class="hero">
      <div class="hero__content">
        <p class="eyebrow">CSIT Student Knowledge Hub</p>
        <h1>CSIT Sheet</h1>
        <p class="hero__lead">
          แพลตฟอร์มจัดเก็บชีทสรุปสำหรับนักศึกษา แยก frontend ด้วย Vue.js และ backend ด้วย Node.js + Express อย่างเป็นระบบ
        </p>
        <div class="hero__actions">
          <RouterLink to="/login" class="button button--primary">เริ่มใช้งาน</RouterLink>
          <button class="button button--ghost" @click="document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })">
            ดูฟีเจอร์
          </button>
        </div>
      </div>

      <div class="hero__visual" aria-hidden="true">
        <img src="@/assets/E7611BAA-F118-4199-88FA-7E6E2663C62B.png" alt="" />
      </div>
    </section>

    <section id="features" class="section">
      <div class="section-heading">
        <p class="eyebrow">Features</p>
        <h2>โครงสร้างชัด ใช้งานง่าย</h2>
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
        <h2>ขั้นตอนการจัดการชีท</h2>
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
      <span>frontend: Vue.js / backend: Node.js + Express</span>
    </footer>
  </div>
</template>
