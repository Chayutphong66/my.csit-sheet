import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks=vi.hoisted(()=>({mine:vi.fn(),create:vi.fn(),detail:vi.fn(),update:vi.fn(),lifecycle:vi.fn(),addSection:vi.fn(),removeSection:vi.fn(),addDocument:vi.fn(),removeDocument:vi.fn(),saveOrder:vi.fn(),uploadCover:vi.fn(),published:vi.fn(),bulk:vi.fn(),retry:vi.fn(),metadata:vi.fn(),courseYears:vi.fn()}))
vi.mock('@/services/collection.service',()=>({collectionApi:{...mocks,coverUrl:slug=>`/cover/${slug}`}}))
vi.mock('@/services/sheet.service',()=>({sheetApi:{metadata:mocks.metadata}}))
vi.mock('@/services/document.service',()=>({documentApi:{courseYears:mocks.courseYears}}))
vi.mock('vue-router',()=>({useRoute:()=>({params:{id:'collection-1',slug:'shared-collection'}})}))
import UserCollectionPanel from '@/components/user/UserCollectionPanel.vue'
import CollectionEditorPanel from '@/components/user/CollectionEditorPanel.vue'
import PublishedCollectionPanel from '@/components/user/PublishedCollectionPanel.vue'
import UserBulkUploadForm from '@/components/user/UserBulkUploadForm.vue'
import CourseDetailPanel from '@/components/user/CourseDetailPanel.vue'

const courses=[{id:'course-a',code:'CA101',name:'Course A'},{id:'course-b',code:'CB202',name:'Course B'}]
const baseCollection={id:'collection-1',name:'Course pack',slug:'course-pack',description:'',collectionType:'COURSE',courseId:'course-a',courseCode:'CA101',publicationStatus:'DRAFT',visibility:'AUTHENTICATED',version:2,documentCount:0,sections:[],unsectioned:[],documents:[]}
const stubs={RouterLink:{props:['to'],template:'<a><slot /></a>'}}

describe('Phase 4 user-facing Collections',()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.mine.mockResolvedValue([{...baseCollection}]);mocks.metadata.mockResolvedValue({programs:[{id:'program-cs',code:'CS'}],courses,academicYears:['2569'],semesters:['1','2']});mocks.create.mockResolvedValue({...baseCollection,id:'created'});mocks.detail.mockResolvedValue({...baseCollection});mocks.saveOrder.mockImplementation((_id,data)=>Promise.resolve({...baseCollection,version:data.expectedVersion+1}));mocks.published.mockResolvedValue({...baseCollection,publicationStatus:'PUBLISHED',sections:[{id:'s1',title:'Start',position:0,documents:[{documentId:'d1',documentType:'Lecture',title:'Intro',courseCode:'CA101',uploaderUsername:'owner'}]}],unsectioned:[]})})

  it('creates an owned COURSE Collection with authoritative course metadata',async()=>{const wrapper=mount(UserCollectionPanel,{global:{stubs}});await flushPromises();const selects=wrapper.findAll('select');await selects[0].setValue('COURSE');await wrapper.find('input').setValue('Algorithms');await wrapper.vm.$nextTick();await wrapper.findAll('select')[1].setValue('course-a');await wrapper.find('form').trigger('submit');await flushPromises();expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({name:'Algorithms',collectionType:'COURSE',courseId:'course-a'}))})

  it('saves explicit section and document order with a concurrency version',async()=>{mocks.detail.mockResolvedValue({...baseCollection,sections:[{id:'s1',title:'One',position:0,documents:[]},{id:'s2',title:'Two',position:1,documents:[]}],unsectioned:[{documentType:'Sheet',documentId:'d1',title:'Doc',sectionId:null}]});const wrapper=mount(CollectionEditorPanel,{global:{stubs}});await flushPromises();const save=wrapper.findAll('button').find(button=>button.text()==='บันทึกลำดับ');await save.trigger('click');await flushPromises();expect(mocks.saveOrder).toHaveBeenCalledWith('collection-1',{expectedVersion:2,sections:['s1','s2'],documents:[{documentType:'Sheet',documentId:'d1',sectionId:null}]})})

  it('renders a shareable authenticated Collection with ordered attribution',async()=>{const wrapper=mount(PublishedCollectionPanel,{global:{stubs}});await flushPromises();expect(wrapper.text()).toContain('Start');expect(wrapper.text()).toContain('Intro');expect(wrapper.text()).toContain('@owner')})

  it('submits shared metadata and per-file overrides in user Bulk Upload',async()=>{mocks.bulk.mockResolvedValue({id:'job-1',status:'COMPLETED',succeededItems:2,failedItems:0,items:[]});const wrapper=mount(UserBulkUploadForm);await flushPromises();Object.assign(wrapper.vm.shared,{programId:'program-cs',courseId:'course-a',academicYear:'2569',semester:'1',documentType:'Sheet'});wrapper.vm.files=[{clientKey:'one',title:'One',fileName:'one.txt',fileType:'text/plain',fileData:'b25l',courseId:'',documentType:''},{clientKey:'two',title:'Two',fileName:'two.txt',fileType:'text/plain',fileData:'dHdv',courseId:'course-b',documentType:'Lecture'}];await wrapper.vm.$nextTick();await wrapper.find('form').trigger('submit');await flushPromises();expect(mocks.bulk).toHaveBeenCalledWith(expect.objectContaining({sharedMetadata:expect.objectContaining({courseId:'course-a'}),items:[expect.objectContaining({clientKey:'one'}),expect.objectContaining({clientKey:'two',courseId:'course-b',documentType:'Lecture'})]}))})
  it('shows published COURSE Collections on the matching course page',async()=>{mocks.courseYears.mockResolvedValue({course:{id:'course-a',code:'CA101',name:'Course A',description:''},years:[],collections:[{...baseCollection,publicationStatus:'PUBLISHED'}]});const wrapper=mount(CourseDetailPanel,{global:{stubs}});await flushPromises();expect(wrapper.text()).toContain('Course Collections');expect(wrapper.text()).toContain('Course pack')})
})
