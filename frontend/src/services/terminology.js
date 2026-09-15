export const UI_TERMS = Object.freeze({
  home: 'หน้าหลัก', lectures: 'เอกสารการสอน', sheets: 'ชีทสรุป', upload: 'อัปโหลด',
  profile: 'โปรไฟล์', search: 'ค้นหา', view: 'ดูเอกสาร', download: 'ดาวน์โหลด',
  helpful: 'มีประโยชน์', contributor: 'ผู้แบ่งปัน', myContributions: 'การแบ่งปันของฉัน',
  actionNeeded: 'ต้องดำเนินการ'
})

const statusTerms = Object.freeze({
  PENDING: 'รอตรวจสอบ', PROCESSING: 'กำลังประมวลผล', APPROVED: 'อนุมัติแล้ว',
  COMPLETED: 'เผยแพร่แล้ว', REJECTED: 'ปฏิเสธแล้ว', FAILED: 'ไม่สำเร็จ'
})
const duplicateTerms = Object.freeze({
  NONE: 'ไม่พบเอกสารซ้ำ', EXACT_DUPLICATE: 'เอกสารซ้ำ',
  CONTENT_DUPLICATE: 'เนื้อหาซ้ำ', POSSIBLE_DUPLICATE: 'อาจเป็นเอกสารซ้ำ'
})

export function documentTypeLabel(type) { return String(type).toLowerCase() === 'lecture' ? 'เอกสารการสอน' : 'ชีทสรุป' }
export function statusLabel(status) { return statusTerms[status] || status }
export function duplicateLabel(status) { return duplicateTerms[status] || status }
