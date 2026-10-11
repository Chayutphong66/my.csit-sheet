<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collectionApi } from '@/services/collection.service'

const route = useRoute()
const router = useRouter()
const collection = ref(null)
const loading = ref(true)
const fileLoading = ref(false)
const error = ref('')
const fileError = ref('')
const objectUrl = ref('')
const heading = ref(null)

const groups = computed(() => {
  if (!collection.value) return []
  const result = []
  if (collection.value.unsectioned?.length) result.push({ id: 'unsectioned', title: 'เอกสารทั่วไป', documents: collection.value.unsectioned })
  for (const section of collection.value.sections || []) result.push({ id: section.id, title: section.title, documents: section.documents || [] })
  return result
})
const orderedDocuments = computed(() => groups.value.flatMap(group => group.documents.map(document => ({ ...document, sectionTitle: group.title }))))
const currentIndex = computed(() => orderedDocuments.value.findIndex(document => document.documentType.toLowerCase() === String(route.params.type || '').toLowerCase() && document.documentId === route.params.documentId))
const current = computed(() => orderedDocuments.value[currentIndex.value] || null)
const previous = computed(() => currentIndex.value > 0 ? orderedDocuments.value[currentIndex.value - 1] : null)
const next = computed(() => currentIndex.value >= 0 ? orderedDocuments.value[currentIndex.value + 1] || null : null)
const isPdf = computed(() => current.value && /^application\/pdf(?:$|;)/i.test(current.value.fileContentType || '') || /^application\/pdf(?:$|;)/i.test(fileType.value))
const fileType = ref('')

function readerLocation(document) {
  return { name: 'collection-reader', params: { slug: route.params.slug, type: document.documentType.toLowerCase(), documentId: document.documentId } }
}
function revokeFile() {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = ''
  fileType.value = ''
}
async function load() {
  loading.value = true
  error.value = ''
  fileError.value = ''
  revokeFile()
  try {
    collection.value = await collectionApi.published(route.params.slug)
    if (!orderedDocuments.value.length) return
    if (!route.params.type || !route.params.documentId) {
      await router.replace(readerLocation(orderedDocuments.value[0]))
      return
    }
    if (!current.value) {
      error.value = 'เอกสารนี้ไม่พร้อมใช้งานหรือไม่ได้อยู่ใน Collection นี้แล้ว'
      return
    }
    fileLoading.value = true
    try {
      const result = await collectionApi.readerFile(collection.value.slug, current.value)
      fileType.value = result.contentType || result.blob?.type || ''
      objectUrl.value = URL.createObjectURL(result.blob)
    } catch (cause) {
      fileError.value = cause.message || 'ไม่สามารถเปิดไฟล์เอกสารได้'
    } finally {
      fileLoading.value = false
    }
    await nextTick()
    heading.value?.focus()
  } catch (cause) {
    error.value = cause.message || 'ไม่สามารถเปิด Collection ได้'
  } finally {
    loading.value = false
  }
}
function onKeydown(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return
  if (event.key === 'ArrowLeft' && previous.value) { event.preventDefault(); router.push(readerLocation(previous.value)) }
  if (event.key === 'ArrowRight' && next.value) { event.preventDefault(); router.push(readerLocation(next.value)) }
}

watch(() => [route.params.slug, route.params.type, route.params.documentId], load, { immediate: true })
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); revokeFile() })
</script>

<template>
  <section class="reader-page" aria-labelledby="reader-title">
    <p v-if="loading" class="reader-state" role="status">กำลังเตรียม Collection Reader…</p>
    <div v-else-if="error" class="reader-state reader-state--error" role="alert">
      <h1>ไม่สามารถเปิดเอกสารได้</h1><p>{{ error }}</p>
      <RouterLink class="button button--ghost" :to="`/dashboard/c/${route.params.slug}`">กลับไปหน้า Collection</RouterLink>
    </div>
    <div v-else-if="collection && !orderedDocuments.length" class="reader-state">
      <h1 id="reader-title">{{ collection.name }}</h1><p>Collection นี้ยังไม่มีเอกสารที่พร้อมอ่าน</p>
      <RouterLink class="button button--ghost" :to="`/dashboard/c/${collection.slug}`">กลับไปหน้า Collection</RouterLink>
    </div>
    <div v-else-if="collection && current" class="reader-layout">
      <aside class="reader-toc">
        <RouterLink class="text-link" :to="`/dashboard/c/${collection.slug}`">← {{ collection.name }}</RouterLink>
        <h2>สารบัญ</h2>
        <nav aria-label="สารบัญ Collection">
          <section v-for="group in groups" :key="group.id" class="reader-toc__group">
            <h3>{{ group.title }}</h3>
            <RouterLink v-for="document in group.documents" :key="`${document.documentType}:${document.documentId}`" :to="readerLocation(document)" :aria-current="document.documentId === current.documentId && document.documentType === current.documentType ? 'page' : undefined">
              <span>{{ document.title }}</span><small>{{ document.documentType === 'Lecture' ? 'Lecture' : 'Sheet' }}</small>
            </RouterLink>
          </section>
        </nav>
      </aside>
      <article class="reader-content">
        <header class="reader-header">
          <div><p class="eyebrow">{{ current.sectionTitle }}</p><h1 id="reader-title" ref="heading" tabindex="-1">{{ current.title }}</h1><p class="material-meta"><span class="type-chip">{{ current.documentType }}</span> {{ current.courseCode }} · {{ current.courseName }} · @{{ current.uploaderUsername }}</p></div>
          <span class="reader-count" aria-label="ลำดับเอกสาร">{{ currentIndex + 1 }} / {{ orderedDocuments.length }}</span>
        </header>
        <p v-if="fileLoading" class="reader-file-state" role="status">กำลังโหลดไฟล์…</p>
        <div v-else-if="fileError" class="reader-file-state reader-state--error" role="alert"><h2>ไฟล์ไม่พร้อมใช้งาน</h2><p>{{ fileError }}</p><button class="button button--ghost" type="button" @click="load">ลองอีกครั้ง</button></div>
        <iframe v-else-if="objectUrl && isPdf" class="reader-frame" :src="objectUrl" :title="`เอกสาร PDF: ${current.title}`" />
        <div v-else-if="objectUrl" class="reader-file-state"><h2>ไฟล์นี้ไม่รองรับการอ่านในหน้าเว็บ</h2><p>เปิดไฟล์ในแท็บใหม่เพื่อดูด้วยโปรแกรมที่รองรับ</p><a class="button button--primary" :href="objectUrl" target="_blank" rel="noopener noreferrer">เปิดไฟล์</a></div>
        <nav class="reader-pager" aria-label="เปลี่ยนเอกสาร">
          <RouterLink v-if="previous" class="button button--ghost" :to="readerLocation(previous)" aria-keyshortcuts="ArrowLeft">← ก่อนหน้า<span>{{ previous.title }}</span></RouterLink><span v-else />
          <RouterLink v-if="next" class="button button--primary" :to="readerLocation(next)" aria-keyshortcuts="ArrowRight">ถัดไป →<span>{{ next.title }}</span></RouterLink><span v-else class="reader-complete">อ่านครบแล้ว</span>
        </nav>
      </article>
    </div>
  </section>
</template>
