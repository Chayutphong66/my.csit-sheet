<script setup>
import AppNavbar from '@/components/layout/AppNavbar.vue'

const features = [
  { title: 'ค้นพบอย่างเป็นระบบ', body: 'เอกสารการสอนและชีทสรุปแยกชัด ค้นหาตามรายวิชา ปี และภาคเรียนได้ง่าย' },
  { title: 'แบ่งปันอย่างมีคุณภาพ', body: 'ส่งเอกสารพร้อมข้อมูลรายวิชา ติดตามผลตรวจสอบ และเห็นผลกระทบของผลงาน' },
  { title: 'ชุมชนที่น่าเชื่อถือ', body: 'ผู้ดูแลตรวจคุณภาพและเอกสารซ้ำก่อนเผยแพร่ให้ทุกคนใช้งาน' }
]

const steps = ['ค้นหารายวิชา', 'เลือกเอกสาร', 'ใช้งานและบอกว่ามีประโยชน์', 'แบ่งปันความรู้ต่อ']
</script>

<template>
  <div>
    <AppNavbar />

    <section class="hero">
      <div class="hero__content">
        <p class="eyebrow">CSIT knowledge sharing</p>
        <h1>เรียนง่ายขึ้น เมื่อความรู้ถูกแบ่งปัน</h1>
        <p class="hero__lead">
          คลังเอกสารการสอน ชีทสรุป และผลงานจากเพื่อนนักศึกษา ที่ค้นหา ใช้งาน และส่งต่อคุณค่าได้ในพื้นที่เดียว
        </p>
        <div class="hero__actions">
          <RouterLink to="/login" class="button button--primary">เริ่มสำรวจคลังความรู้</RouterLink>
          <button class="button button--ghost" type="button" @click="document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })">
            ดูว่าระบบทำงานอย่างไร
          </button>
        </div>
      </div>

      <div class="hero__visual" aria-hidden="true">
        <img src="@/assets/E7611BAA-F118-4199-88FA-7E6E2663C62B.png" alt="" />
      </div>
    </section>

    <section id="features" class="section">
      <div class="section-heading">
        <p class="eyebrow">Designed for students</p>
        <h2>จากคลังไฟล์ สู่ชุมชนความรู้ที่เห็นคุณค่าของคนแบ่งปัน</h2>
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
        <p class="eyebrow">Community loop</p>
        <h2>ค้นพบ ใช้งาน ขอบคุณ และแบ่งปันต่อ</h2>
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
      <span>พื้นที่แบ่งปันความรู้สำหรับนักศึกษา CSIT</span>
    </footer>
  </div>
</template>
