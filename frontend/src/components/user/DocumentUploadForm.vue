<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { sheetApi } from '@/services/sheet.service'
import { uploadApi } from '@/services/upload.service'
import TeacherSuggestionDialog from './TeacherSuggestionDialog.vue'

const emit = defineEmits(['uploaded'])
const metadata = ref({ programs: [], academicYears: [], semesters: ['1', '2'], documentTypes: [] })
const teachers = ref([]), suggestions = ref([]), loadingMetadata = ref(true), loadingCourses = ref(false), loadingTeachers = ref(false), submitting = ref(false)
const message = ref(''), error = ref(''), teacherError = ref(''), fileInput = ref(null), suggestionOpen = ref(false)
const duplicateMatches = ref([]), exactDuplicate = ref(false)
const codeText = ref(''), nameText = ref(''), activeSearch = ref(''), activeIndex = ref(0), selectedCourse = ref(null)
let teacherGeneration = 0, searchGeneration = 0, searchTimer
const emptyForm = () => ({ title:'', description:'', fileName:'', fileSize:0, fileType:'', fileData:'', programId:'', courseId:'', documentType:'', academicYear:'', semester:'', instructorIds:[], suggestionIds:[] })
const form = ref(emptyForm())
const MAX_FILE_BYTES = 20 * 1024 * 1024
const ACCEPTED_FILES = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png'
const MIME_BY_EXTENSION = { pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png' }
const selectedProgram = computed(() => (metadata.value.programs || []).find(program => program.id === form.value.programId))
const contextReady = computed(() => form.value.programId && form.value.academicYear && form.value.semester)
const teacherDependenciesReady = computed(() => contextReady.value && form.value.courseId)

onMounted(async () => { try { metadata.value = await sheetApi.metadata() } catch { error.value = 'โหลดข้อมูลสำหรับอัปโหลดไม่สำเร็จ' } finally { loadingMetadata.value = false } })
watch(() => [form.value.programId, form.value.academicYear, form.value.semester], () => clearCourse())
watch(() => form.value.courseId, async courseId => {
  const current = ++teacherGeneration; form.value.instructorIds = []; teachers.value = []; teacherError.value = ''
  if (!teacherDependenciesReady.value || !courseId) return
  loadingTeachers.value = true
  try { const result = await sheetApi.teachers(courseId, form.value.academicYear, form.value.semester, form.value.programId); if (current === teacherGeneration) teachers.value = result.teachers || [] }
  catch { if (current === teacherGeneration) teacherError.value = 'โหลดข้อมูลผู้สอนไม่สำเร็จ' }
  finally { if (current === teacherGeneration) loadingTeachers.value = false }
})
watch(() => [form.value.title, form.value.fileData, form.value.courseId, form.value.documentType, form.value.academicYear, form.value.semester], () => {
  duplicateMatches.value = []
  exactDuplicate.value = false
})
onBeforeUnmount(() => { teacherGeneration++; searchGeneration++; clearTimeout(searchTimer) })

function clearCourse() { selectedCourse.value=null; form.value.courseId=''; form.value.instructorIds=[]; codeText.value=''; nameText.value=''; suggestions.value=[]; activeSearch.value=''; teacherGeneration++ }
function onCourseInput(kind) {
  if (form.value.courseId) { form.value.courseId=''; selectedCourse.value=null; form.value.instructorIds=[] }
  activeSearch.value=kind; activeIndex.value=0; clearTimeout(searchTimer)
  const query=(kind==='code'?codeText.value:nameText.value).trim()
  if (!contextReady.value || query.length < (kind==='code'?1:2)) { suggestions.value=[]; return }
  const current=++searchGeneration; searchTimer=setTimeout(async()=>{loadingCourses.value=true;try{const result=await sheetApi.searchCourses({query,program:form.value.programId,year:form.value.academicYear,semester:form.value.semester});if(current===searchGeneration)suggestions.value=result.courses||[]}catch{if(current===searchGeneration)suggestions.value=[]}finally{if(current===searchGeneration)loadingCourses.value=false}},250)
}
function chooseCourse(course){selectedCourse.value=course;form.value.courseId=course.id;codeText.value=course.code;nameText.value=course.nameEn||course.name;suggestions.value=[];activeSearch.value=''}
function navigate(event){if(!suggestions.value.length)return;if(event.key==='ArrowDown'){event.preventDefault();activeIndex.value=(activeIndex.value+1)%suggestions.value.length}else if(event.key==='ArrowUp'){event.preventDefault();activeIndex.value=(activeIndex.value-1+suggestions.value.length)%suggestions.value.length}else if(event.key==='Enter'){event.preventDefault();chooseCourse(suggestions.value[activeIndex.value])}else if(event.key==='Escape'){suggestions.value=[];activeSearch.value=''}}
function formatFileSize(bytes){return !bytes?'0 bytes':bytes<1048576?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1048576).toFixed(1)} MB`}
function resetFile(){Object.assign(form.value,{fileName:'',fileSize:0,fileType:'',fileData:''});if(fileInput.value)fileInput.value.value=''}
function onFileChange(event){error.value='';const file=event.target.files?.[0];if(!file)return;if(file.size>MAX_FILE_BYTES){error.value='ไฟล์มีขนาดเกิน 20 MB';resetFile();return}form.value.fileName=file.name;form.value.fileSize=file.size;const ext=file.name.split('.').pop()?.toLowerCase();form.value.fileType=file.type&&file.type!=='application/octet-stream'?file.type:MIME_BY_EXTENSION[ext]||'';const reader=new FileReader();reader.onload=()=>{form.value.fileData=String(reader.result).split(',')[1]??''};reader.onerror=()=>{error.value='ไม่สามารถอ่านไฟล์ที่เลือกได้';form.value.fileData=''};reader.readAsDataURL(file);if(!form.value.title)form.value.title=file.name.replace(/\.[^.]+$/,'')}
async function submitUpload(forceNew=false){error.value='';message.value='';if(!form.value.fileData){error.value='กรุณาเลือกไฟล์ก่อนส่งตรวจสอบ';return}if(!form.value.courseId){error.value='กรุณาเลือกรายวิชาจากรายการค้นหา';return}submitting.value=true;try{if(!forceNew){const result=await uploadApi.checkDuplicates(form.value);duplicateMatches.value=result.matches||[];exactDuplicate.value=Boolean(result.exactDuplicate);if(duplicateMatches.value.length)return}const request=await uploadApi.createUploadRequest(form.value);message.value=`ส่ง “${request.fileName}” ให้ผู้ดูแลตรวจสอบแล้ว`;duplicateMatches.value=[];exactDuplicate.value=false;form.value=emptyForm();selectedCourse.value=null;codeText.value='';nameText.value='';resetFile();emit('uploaded',request)}catch(caught){error.value=caught.message}finally{submitting.value=false}}
function suggested(suggestion){suggestionOpen.value=false;form.value.suggestionIds.push(suggestion.id);message.value='ส่งข้อมูลอาจารย์ให้ผู้ดูแลตรวจสอบแล้ว ระบบจะผูกคำแนะนำนี้กับเอกสารเมื่ออัปโหลด'}
</script>

<template>
  <form class="form request-form" @submit.prevent="submitUpload()">
    <div v-if="message" class="form-success" role="status">{{ message }}</div><div v-if="error" class="form-error" role="alert">{{ error }}</div>
    <section class="upload-dropzone"><input ref="fileInput" type="file" :accept="ACCEPTED_FILES" required @change="onFileChange" /><span class="upload-dropzone__title">ลากไฟล์มาวาง หรือเลือกไฟล์จากเครื่อง</span><span class="upload-dropzone__hint">รองรับ PDF, Office, text, JPG และ PNG ขนาดไม่เกิน 20 MB</span><div v-if="form.fileName" class="upload-file"><span>{{ form.fileName }} - {{ formatFileSize(form.fileSize) }}</span><button class="button button--ghost button--small" type="button" @click.stop="resetFile">นำไฟล์ออก</button></div></section>
    <label>ชื่อเอกสาร *<input v-model="form.title" required maxlength="200" placeholder="เช่น สรุป Algorithm ก่อนสอบ" /></label>
    <label>คำอธิบายเพิ่มเติม<textarea v-model.trim="form.description" maxlength="1000" rows="4" placeholder="อธิบายเนื้อหา ขอบเขตบท หรือการใช้งานเอกสาร"></textarea><small class="material-meta">{{ form.description.length }} / 1000</small></label>
    <div class="form-grid">
      <label class="field-span-2">สาขา *<select v-model="form.programId" required :disabled="loadingMetadata"><option value="" disabled>เลือกสาขา</option><option v-for="program in metadata.programs" :key="program.id" :value="program.id">{{ program.nameTh }}</option></select></label>
      <label>ปีการศึกษา *<select v-model="form.academicYear" required :disabled="loadingMetadata"><option value="" disabled>{{ loadingMetadata?'กำลังโหลด…':'เลือกปีการศึกษา' }}</option><option v-for="year in metadata.academicYears" :key="year">{{ year }}</option></select></label>
      <label>ภาคเรียน *<select v-model="form.semester" required :disabled="loadingMetadata"><option value="" disabled>เลือกภาคเรียน</option><option v-for="semester in metadata.semesters" :key="semester" :value="semester">ภาคเรียนที่ {{ semester }}</option></select></label>
      <div class="autocomplete-field"><label for="course-code">รหัสวิชา *</label><input id="course-code" v-model="codeText" :disabled="!contextReady" autocomplete="off" role="combobox" :aria-expanded="activeSearch==='code'&&Boolean(suggestions.length)" placeholder="พิมพ์รหัสวิชา" @input="onCourseInput('code')" @keydown="navigate" /></div>
      <div class="autocomplete-field"><label for="course-name">ชื่อวิชา *</label><input id="course-name" v-model="nameText" :disabled="!contextReady" autocomplete="off" role="combobox" :aria-expanded="activeSearch==='name'&&Boolean(suggestions.length)" placeholder="พิมพ์ชื่อวิชา" @input="onCourseInput('name')" @keydown="navigate" /></div>
      <div v-if="activeSearch" class="course-suggestions field-span-2" role="listbox"><p v-if="loadingCourses">กำลังค้นหารายวิชา...</p><button v-for="(course,index) in suggestions" v-else :key="course.id" type="button" role="option" :aria-selected="index===activeIndex" :class="{'is-active':index===activeIndex}" @mousedown.prevent="chooseCourse(course)"><strong>{{ course.code }}</strong><span>{{ course.nameEn||course.name }}</span></button><p v-if="!loadingCourses&&!suggestions.length">ไม่พบรายวิชาที่ตรงกับการค้นหา</p></div>
      <fieldset class="teacher-field field-span-2"><legend>อาจารย์ผู้สอน</legend><p v-if="!teacherDependenciesReady" class="material-meta">กรุณาเลือกรายวิชาก่อน</p><p v-else-if="loadingTeachers" class="material-meta">กำลังโหลดข้อมูลผู้สอน...</p><p v-else-if="teacherError" class="form-error">{{ teacherError }}</p><template v-else><label v-for="teacher in teachers" :key="teacher.id" class="checkbox-row"><input v-model="form.instructorIds" type="checkbox" :value="teacher.id" /> {{ teacher.name }}</label><p v-if="!teachers.length" class="material-meta">ยังไม่มีข้อมูลผู้สอนสำหรับรายวิชานี้</p><button class="button button--ghost button--small" type="button" :disabled="!teacherDependenciesReady" @click="suggestionOpen=true">+ เพิ่ม/เสนอชื่ออาจารย์</button></template></fieldset>
      <label class="field-span-2">ประเภทเอกสาร *<select v-model="form.documentType" required><option value="" disabled>เลือกประเภทเอกสาร</option><option v-for="type in metadata.documentTypes" :key="type" :value="type">{{ type==='Lecture'?'เอกสารการสอน':'ชีทสรุป' }}</option></select></label>
    </div>
    <section v-if="duplicateMatches.length" class="duplicate-suggestions" aria-live="polite">
      <h3>{{ exactDuplicate ? 'พบไฟล์เดียวกันในระบบ' : 'พบเอกสารที่อาจเป็นรายการเดียวกัน' }}</h3>
      <p>{{ exactDuplicate ? 'ไม่จำเป็นต้องอัปโหลดไฟล์ซ้ำ กรุณาเปิดเอกสารเดิมหรือเพิ่มเป็นเวอร์ชันใหม่' : 'ตรวจสอบรายการด้านล่างก่อนเลือกสร้างเอกสารใหม่' }}</p>
      <article v-for="match in duplicateMatches" :key="`${match.source}-${match.id}`" class="duplicate-suggestion">
        <div><strong>{{ match.title }}</strong><small>{{ match.courseCode }} · {{ match.academicYear }}/{{ match.semester }} · {{ match.contributor || 'ไม่ระบุผู้ส่ง' }}</small></div>
        <div v-if="match.publicDocumentId" class="button-row">
          <RouterLink class="button button--ghost button--small" :to="`/dashboard/documents/${match.documentType}/${match.publicDocumentId}`">เปิดเอกสารเดิม</RouterLink>
          <RouterLink class="button button--secondary button--small" :to="`/dashboard/documents/${match.documentType}/${match.publicDocumentId}?revision=1#submit-revision`">เพิ่มเป็นเวอร์ชันใหม่</RouterLink>
        </div>
        <small v-else>มีคำขอที่กำลังรอตรวจสอบอยู่แล้ว</small>
      </article>
      <button v-if="!exactDuplicate" class="button button--primary" type="button" :disabled="submitting" @click="submitUpload(true)">ยืนยันอัปโหลดเป็นเอกสารใหม่</button>
    </section>
    <p class="section-copy">ผู้ดูแลจะตรวจคุณภาพ เอกสารซ้ำ และข้อมูลผู้สอนก่อนเผยแพร่</p><button class="button button--primary" :disabled="submitting||loadingMetadata" type="submit">{{ submitting?'กำลังส่ง…':'ส่งให้ผู้ดูแลตรวจสอบ' }}</button>
  </form>
  <TeacherSuggestionDialog :open="suggestionOpen" :course="selectedCourse" :program="selectedProgram" :academic-year="form.academicYear" :semester="form.semester" @close="suggestionOpen=false" @submitted="suggested" />
</template>
