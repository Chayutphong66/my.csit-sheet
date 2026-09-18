<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppNavbar from '@/components/layout/AppNavbar.vue'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const page = ref(null)
const paused = ref(false)
const browseTo = computed(() => auth.user?.role === 'ADMIN' ? '/admin' : auth.user ? '/dashboard/search' : '/login?redirect=/dashboard/search')
const shareTo = computed(() => auth.user?.role === 'ADMIN' ? '/admin/upload' : auth.user ? '/dashboard/upload' : '/register')
const topics = ['รายวิชา', 'เอกสารการสอน', 'ชีทสรุป', 'ผู้แบ่งปัน', 'ความรู้ที่ส่งต่อได้']
const features = [
  { number: '01', label: 'DISCOVER', title: 'ทุกวิชา มีพื้นที่ให้ค้นพบ', body: 'เริ่มจากรายวิชา เลือกปีการศึกษาและภาคเรียน แล้วพบเอกสารที่ตรงกับสิ่งที่กำลังเรียน', tags: ['รายวิชา', 'ปีการศึกษา', 'ภาคเรียน'], wide: true },
  { number: '02', label: 'SHARE', title: 'สิ่งที่คุณเข้าใจ ส่งต่อให้เพื่อนได้', body: 'อัปโหลดเอกสารพร้อมข้อมูลประกอบ ติดตามผลตรวจสอบ และเห็นคุณค่าของการแบ่งปัน', tags: ['อัปโหลด', 'รอตรวจสอบ', 'เผยแพร่'], wide: true },
  { number: '03', label: 'LECTURES', title: 'เอกสารการสอน', body: 'ค้นเนื้อหาประกอบการเรียน แยกจากชีทสรุปอย่างชัดเจน' },
  { number: '04', label: 'SHEETS', title: 'ชีทสรุป', body: 'ทบทวนประเด็นสำคัญจากเอกสารที่เพื่อนนักศึกษาแบ่งปัน' },
  { number: '05', label: 'CONTRIBUTORS', title: 'รู้จักคนแบ่งปัน', body: 'เปิดโปรไฟล์ผู้แบ่งปัน สำรวจผลงาน และขอบคุณผ่าน “มีประโยชน์”' }
]
const steps = [
  { title: 'เลือกสิ่งที่อยากเรียนรู้', body: 'ค้นหาเอกสาร รายวิชา หรือผู้แบ่งปัน' },
  { title: 'เปิดอ่านและนำไปใช้', body: 'ดูตัวอย่างหรือดาวน์โหลดไฟล์ต้นฉบับ' },
  { title: 'ส่งต่อคำขอบคุณ', body: 'บอกว่าเอกสารมีประโยชน์กับการเรียนของคุณ' },
  { title: 'แบ่งปันความรู้ของคุณ', body: 'เติมสิ่งที่เข้าใจให้คลังความรู้ของทุกคน' }
]
let observer
onMounted(() => {
  if (!('IntersectionObserver' in window)) return
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle('is-visible', entry.isIntersecting)
  }, { threshold: .08 })
  page.value.querySelectorAll('[data-reveal], .product-preview').forEach((element) => observer.observe(element))
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="page" class="starter-page" :class="{ 'motion-paused': paused }">
    <a class="skip-link" href="#starter-main">ข้ามไปเนื้อหาหลัก</a>
    <AppNavbar />
    <main id="starter-main">
      <section class="starter-hero">
        <div class="starter-hero__copy">
          <p class="eyebrow"><span class="live-dot" aria-hidden="true"></span> CSIT / KNOWLEDGE SHARING</p>
          <h1>ค้นหา แบ่งปัน<br />และ<span class="hero-highlight">ส่งต่อความรู้.</span></h1>
          <p class="hero__lead">เอกสารการสอน ชีทสรุป และความเข้าใจจากเพื่อนนักศึกษา<br class="desktop-break" /> ค้นพบสิ่งที่ช่วยให้เรียนรู้ได้ดีขึ้น ในพื้นที่เดียวของชาว CSIT</p>
          <div class="hero__actions"><RouterLink :to="browseTo" class="button button--primary">ค้นหาเอกสาร ↗</RouterLink><RouterLink :to="shareTo" class="button button--ghost">เริ่มแบ่งปัน →</RouterLink></div>
          <p class="starter-caption">ค้นพบอย่างเป็นระบบ · แบ่งปันอย่างมีคุณภาพ</p>
        </div>
        <div class="preview-wrap">
          <div class="preview-caption"><span class="eyebrow">PRODUCT PREVIEW</span><button type="button" class="motion-toggle" :aria-pressed="paused" @click="paused = !paused">{{ paused ? 'เล่นภาพเคลื่อนไหว' : 'หยุดภาพเคลื่อนไหว' }}</button></div>
          <div class="product-preview" role="img" aria-label="ภาพสาธิตแนวคิด: ค้นหารายวิชา เลือกเอกสาร ดูผู้แบ่งปัน และส่งคำขอบคุณ ไม่ใช่ข้อมูลเอกสารจริง">
            <div class="preview-topbar"><span class="brand"><span class="brand__mark">CS</span> CSIT Sheet</span><span class="preview-label">ภาพสาธิต</span></div>
            <div class="preview-body" aria-hidden="true">
              <div class="preview-sidebar"><span class="preview-nav-active">ค้นพบ</span><span>เอกสารการสอน</span><span>ชีทสรุป</span><span>ผู้แบ่งปัน</span><div class="preview-sidebar__footer">ความรู้ที่มีคุณค่า<br />เริ่มจากการแบ่งปัน</div></div>
              <div class="preview-content">
                <p class="eyebrow">YOUR NEXT DISCOVERY</p><h2>วันนี้ อยากเรียนรู้อะไร?</h2>
                <div class="preview-search"><span>⌕</span><span class="demo-query">ค้นหารายวิชาและเอกสาร</span><span class="preview-key">↵</span></div>
                <div class="preview-tabs"><span>ทั้งหมด</span><span>เอกสาร</span><span>ผู้แบ่งปัน</span></div>
                <article class="demo-result"><div class="demo-document-icon">≡</div><div><p class="eyebrow">LECTURE / SHEET</p><h3>ความเข้าใจที่ส่งต่อได้</h3><p>รายวิชา → ปีการศึกษา → ภาคเรียน</p><div class="demo-identity"><span class="demo-avatar">CS</span><span>พบผู้แบ่งปัน<br /><small>และผลงานอื่นในโปรไฟล์</small></span></div></div></article>
                <div class="preview-impact"><span>เปิดอ่าน ↗</span><span>ดาวน์โหลด ↓</span><span class="demo-helpful">♡ มีประโยชน์</span></div>
              </div>
            </div>
          </div>
          <div class="preview-footnote"><span class="live-dot" aria-hidden="true"></span> ค้นพบ → ใช้งาน → ขอบคุณ → แบ่งปัน</div>
        </div>
      </section>
      <section class="topic-strip" aria-label="สิ่งที่ค้นพบใน CSIT Sheet"><div class="topic-track"><div v-for="copy in 2" :key="copy" class="topic-group" :aria-hidden="copy === 2 ? 'true' : undefined"><span v-for="topic in topics" :key="topic">{{ topic }} <span class="topic-star" aria-hidden="true">✳</span></span></div></div></section>
      <section id="features" class="section starter-features" data-reveal>
        <header class="starter-section-heading"><div><p class="eyebrow">LESS SEARCHING. MORE LEARNING.</p><h2>ความรู้ไม่ควรกระจัดกระจาย<br />และคนแบ่งปันควรได้รับการมองเห็น</h2></div><p>จากคลังไฟล์ สู่พื้นที่ที่คุณค้นพบเอกสาร<br />รู้จักผู้แบ่งปัน และส่งต่อความเข้าใจได้ง่ายขึ้น</p></header>
        <div class="starter-bento"><article v-for="feature in features" :key="feature.number" class="bento-card" :class="{ 'bento-card--wide': feature.wide }"><div class="bento-card__top"><span class="eyebrow">{{ feature.label }}</span><span class="technical-label">{{ feature.number }}</span></div><h3>{{ feature.title }}</h3><p>{{ feature.body }}</p><div v-if="feature.tags" class="bento-path"><template v-for="(tag, index) in feature.tags" :key="tag"><span v-if="index" aria-hidden="true">→</span><strong>{{ tag }}</strong></template></div><RouterLink v-else :to="browseTo" class="text-link">เริ่มค้นพบ ↗</RouterLink></article></div>
      </section>
      <section class="share-section" data-reveal><div class="share-section__inner"><div><p class="eyebrow">SHARE KNOWLEDGE</p><h2>ความรู้หนึ่งชุด<br />อาจช่วยคนได้<br /><span>มากกว่าหนึ่งคน.</span></h2><p>เอกสารที่คุณแบ่งปันมีผู้ดูแลตรวจสอบก่อนเผยแพร่<br />เมื่อเพื่อนนำไปใช้ ผลงานและคุณค่าของคุณจะมองเห็นได้</p><RouterLink :to="shareTo" class="button button--light">ส่งต่อความรู้ของคุณ ↗</RouterLink></div><div class="impact-showcase"><p class="eyebrow">CONTRIBUTOR IMPACT</p><h3>ทุกการแบ่งปันมีความหมาย</h3><div class="impact-row"><span aria-hidden="true">↗</span><div><strong>ผลงานที่เผยแพร่</strong><p>เอกสารการสอนและชีทสรุปในโปรไฟล์</p></div></div><div class="impact-row"><span aria-hidden="true">↓</span><div><strong>การนำไปใช้</strong><p>ยอดเปิดอ่านและดาวน์โหลดจากเอกสารจริง</p></div></div><div class="impact-row"><span aria-hidden="true">♡</span><div><strong>คำขอบคุณจากชุมชน</strong><p>Helpful คะแนน ระดับ และ badges</p></div></div><p class="impact-note">ให้คุณค่ากับประโยชน์ที่เกิดขึ้น<br />ตรวจสอบเอกสารซ้ำก่อนเผยแพร่</p></div></div></section>
      <section id="workflow" class="section" data-reveal><header class="starter-section-heading"><div><p class="eyebrow">THE COMMUNITY LOOP</p><h2>เริ่มจากความสงสัย<br />ไปต่อด้วยการแบ่งปัน</h2></div><p>ใช้ความรู้ที่มีวันนี้<br />ช่วยให้ใครอีกคนเข้าใจได้ในวันพรุ่งนี้</p></header><ol class="starter-steps"><li v-for="(step, index) in steps" :key="step.title"><span class="technical-label">0{{ index + 1 }}</span><h3>{{ step.title }}</h3><p>{{ step.body }}</p></li></ol></section>
      <section class="starter-cta" data-reveal><p class="eyebrow">A SHARED SPACE TO GROW</p><h2>เรียนรู้ได้ไกลขึ้น<br />เมื่อเราแบ่งปันไปด้วยกัน</h2><div class="hero__actions"><RouterLink :to="browseTo" class="button button--primary">สำรวจคลังความรู้ ↗</RouterLink><RouterLink :to="shareTo" class="button button--ghost">เริ่มแบ่งปัน →</RouterLink></div></section>
    </main>
    <footer id="contact" class="footer starter-footer"><RouterLink to="/" class="brand"><span class="brand__mark">CS</span> CSIT Sheet</RouterLink><span>พื้นที่แบ่งปันความรู้สำหรับนักศึกษา CSIT</span><a href="#starter-main" class="text-link">กลับด้านบน ↑</a></footer>
  </div>
</template>
