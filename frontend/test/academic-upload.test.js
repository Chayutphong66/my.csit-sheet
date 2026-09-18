import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks=vi.hoisted(()=>({metadata:vi.fn(),searchCourses:vi.fn(),teachers:vi.fn(),suggestTeacher:vi.fn(),createUploadRequest:vi.fn()}))
vi.mock('@/services/sheet.service',()=>({sheetApi:{metadata:mocks.metadata,searchCourses:mocks.searchCourses,teachers:mocks.teachers,suggestTeacher:mocks.suggestTeacher}}))
vi.mock('@/services/upload.service',()=>({uploadApi:{createUploadRequest:mocks.createUploadRequest}}))
import DocumentUploadForm from '@/components/user/DocumentUploadForm.vue'

const programs=[{id:'program-it',code:'IT',nameTh:'เทคโนโลยีสารสนเทศ'}]
const courses=[{id:'db',code:'273255',nameEn:'Database Systems',nameTh:'ระบบฐานข้อมูล'},{id:'ooad',code:'273373',nameEn:'OOAD',nameTh:'การวิเคราะห์'}]

describe('dependent academic metadata upload',()=>{
  beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();mocks.metadata.mockResolvedValue({programs,courses,academicYears:['2569','2568'],semesters:['1','2'],documentTypes:['Lecture','Sheet']});mocks.searchCourses.mockImplementation(async({query})=>({courses:courses.filter(course=>`${course.code} ${course.nameEn}`.toLowerCase().includes(query.toLowerCase()))}));mocks.teachers.mockImplementation(async(id,_year,term)=>({teachers:id==='db'&&term==='1'?[{id:'a',name:'Teacher A'}]:[]}));mocks.suggestTeacher.mockResolvedValue({id:'suggestion'})})
  afterEach(()=>vi.useRealTimers())

  async function selectContext(wrapper){const selects=wrapper.findAll('select');await selects[0].setValue('program-it');await selects[1].setValue('2569');await selects[2].setValue('1')}
  async function choose(wrapper,text){const input=wrapper.get('#course-code');await input.setValue(text);await vi.advanceTimersByTimeAsync(260);await flushPromises();await wrapper.get('[role=option]').trigger('mousedown');await flushPromises()}

  it('syncs course fields, loads multiple verified teachers, and clears stale selection',async()=>{const wrapper=mount(DocumentUploadForm,{attachTo:document.body});await flushPromises();await selectContext(wrapper);await choose(wrapper,'273255');expect(mocks.teachers).toHaveBeenLastCalledWith('db','2569','1','program-it');expect(wrapper.get('#course-name').element.value).toBe('Database Systems');expect(wrapper.findAll('.teacher-field input[type=checkbox]')).toHaveLength(1);await wrapper.find('.teacher-field input[type=checkbox]').setValue(true);await wrapper.get('#course-code').setValue('273373');expect(wrapper.findAll('.teacher-field input[type=checkbox]')).toHaveLength(0);wrapper.unmount()})

  it('submits a contextual suggestion and keeps its id for the upload',async()=>{const wrapper=mount(DocumentUploadForm,{attachTo:document.body});await flushPromises();await selectContext(wrapper);await choose(wrapper,'273373');await wrapper.findAll('button').find(button=>button.text().includes('เสนอชื่อ')).trigger('click');await flushPromises();const dialog=document.body.querySelector('[role=dialog]');expect(dialog.textContent).toContain('เทคโนโลยีสารสนเทศ');expect(dialog.textContent).toContain('273373');const input=dialog.querySelector('input');input.value='อาจารย์ทดสอบ';input.dispatchEvent(new Event('input',{bubbles:true}));const textarea=dialog.querySelector('textarea');textarea.value='สอนร่วม';textarea.dispatchEvent(new Event('input',{bubbles:true}));dialog.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await flushPromises();expect(mocks.suggestTeacher).toHaveBeenCalledWith({teacherName:'อาจารย์ทดสอบ',note:'สอนร่วม',courseId:'ooad',academicYear:'2569',semester:'1'});expect(document.body.querySelector('[role=dialog]')).toBeNull();expect(wrapper.text()).toContain('ผูกคำแนะนำนี้กับเอกสาร');wrapper.unmount()})
})
