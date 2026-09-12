# Code Review

## 1. สรุปการเปลี่ยนแปลง

ปรับโครงสร้างการใช้งานโดยต่อยอดระบบเดิม: Home, Lectures และ Sheets ใช้แหล่งข้อมูลเอกสารที่เผยแพร่แล้วชุดเดียวกัน; Upload รวมแบบฟอร์มกับประวัติ; Profile แสดงข้อมูลผู้ใช้และผลงานที่ส่งทั้งหมด โดยไม่สร้างตารางเอกสารหรือผลงานซ้ำ

## 2. Navigation หลังปรับ

เมนูหลักเป็น Home, Lectures, Sheets, Upload, Profile ครบห้ารายการ ถอด Search และ My Upload Requests ออกจากเมนูหลัก โดย Global Search ยังเข้าจาก Home และ `/dashboard/requests` redirect ไป Upload เพื่อรองรับลิงก์เก่า

## 3. Home

Home แสดง Course จากฐานข้อมูล แล้วนำทาง Course → Academic Year → Semester → Documents จำนวน Course/Year/Semester และรายการเอกสารมาจาก public read model จริง เอกสารแสดงชนิด Lecture/Sheet พร้อม View และ Download

## 4. Lectures

Lectures ใช้ hierarchy component และ API เดียวกับ Home แต่ส่ง structured filter `type=Lecture` ทุกระดับ ตั้งแต่ Course count, Year count, Semester list และ Search จึงไม่พึ่งชื่อไฟล์หรือ frontend filtering เพื่อจำแนกประเภท

## 5. Sheets

Sheets ใช้กลไกเดียวกับ Lectures โดยส่ง `type=Sheet` และแสดงเฉพาะ Course/Year/Semester ที่มี Sheet ซึ่งเผยแพร่แล้ว

## 6. Upload

Upload เป็นหน้าหลักเพียงหน้าเดียว มีแท็บ Upload Material และ My Uploads แบบฟอร์มเดิมถูกย้ายมาใช้ที่นี่เพียงแห่งเดียว ประวัติยังอ่าน `upload_requests` เดิมและแสดง Pending, Published, Rejected พร้อม metadata, เหตุผลปฏิเสธ และ duplicate status

## 7. Profile

Profile ไม่มีแบบฟอร์ม Upload แล้ว แสดงรูปโปรไฟล์หรืออักษรย่อ, username, email, role, My Contributions, สถิติ และผลงานล่าสุด ครอบคลุมทั้ง Lecture และ Sheet

## 8. Search

Global Search ไม่ส่ง type จึงค้นทั้งสองประเภท ส่วน Lecture/Sheet Search เรียก endpoint เดียวกันพร้อม type ที่ตรวจสอบแล้ว ค้นจาก Course code/name, title, filename, academic year และ semester

## 9. Source of Truth

Home/Lectures/Sheets/Search/View/Download อ่าน public read model แบบ `UNION ALL` จาก `lectures` + `lecture_files` และ `sheets` + `sheet_files` ที่สถานะ APPROVED เท่านั้น ไม่มี search store หรือ catalog copy เพิ่ม การนับผลงานใช้ `upload_requests` หนึ่งแถวต่อหนึ่ง submission

## 10. Database/API Changes

รอบนี้ไม่เพิ่ม schema ใหม่ เพิ่ม optional query `type=Lecture|Sheet` ให้ Course hierarchy และ document search และเพิ่ม `GET /api/upload-requests/contributions` ซึ่งบังคับ role USER และใช้ `req.user.id`

## 11. Bugs Found and Fixed

- อาการ: Lectures/Sheets ใช้ catalog และ filter คนละทางกับ Home; สาเหตุ: component เก่าเรียก API แยก; วิธีแก้: ใช้ shared hierarchy/query พร้อม type; ผล: count/list/search สอดคล้องกัน
- อาการ: Upload form อยู่ Profile แต่ history อยู่เมนูอื่น; สาเหตุ: navigation เดิมแบ่ง workflow; วิธีแก้: รวมเป็น Upload tabs และทำ legacy redirect; ผล: เหลือ workflow เดียว
- อาการ: Profile ไม่มีผลงาน Lecture และเสี่ยงนับ request + public record ซ้ำ; สาเหตุ: ไม่มี contribution source ที่ชัดเจน; วิธีแก้: aggregate จาก owned upload requests เท่านั้น; ผล: approval เปลี่ยน status count แต่ total ไม่เพิ่ม
- อาการ: ผลงาน pending/rejected เปิดแล้วไปหน้า form; สาเหตุ: Upload ไม่อ่าน request query; วิธีแก้: เปิด My Uploads และเลือก request จาก query; ผล: contribution link ไปบริบทที่ถูกต้อง

## 12. Duplicate Detection Regression

- Exact Duplicate: PASS
- Possible Duplicate: PASS
- Pending Duplicate: PASS
- Reject as Duplicate: PASS
- Idempotent Approval: PASS

## 13. 3-Actor Tests

### user1 → Lecture → admin1 approve → user2

Home PASS, Lectures PASS, Sheets isolation PASS, Search PASS, View PASS, Download PASS, Upload history PASS, Profile contribution PASS

### user1 → Sheet → admin1 approve → user2

Home PASS, Sheets PASS, Lectures isolation PASS, Search PASS, View PASS, Download PASS, Upload history PASS, Profile contribution PASS

### admin1 → Lecture → user1/user2

Home PASS, Lectures PASS, Sheets isolation PASS, Search/View/Download PASS

### admin1 → Sheet → user1/user2

Home PASS, Sheets PASS, Lectures isolation PASS, Search/View/Download PASS

## 14. Profile Contribution Test

Total Contributions, Lecture count, Sheet count, Published, Pending และ Rejected มาจากฐานข้อมูลและผ่าน lifecycle test การอนุมัติ submission เดิมไม่เพิ่ม total ยืนยันว่า one submission = one contribution

## 15. Permission Review

user1 และ user2 เห็นเฉพาะประวัติ/ผลงานของตนเอง เข้าถึง request ของกันและกันไม่ได้ และใช้ Admin API ไม่ได้ ส่วน admin1 review/approve/reject/duplicate ได้ตาม role Public endpoints ยังตรวจ authentication และสถานะเผยแพร่

## 16. UI/Responsive Review

Component render tests ผ่านสำหรับ navigation, Home/typed catalog, Upload tabs, history, Profile และ Admin duplicate UI มี breakpoint ที่ 980px และ 720px ครอบคลุม grid/form/card/navigation แต่ visual screenshot ที่ 375/768/1024/1440 เป็น NOT RUN เพราะ browser connector ใช้งานไม่ได้ใน environment นี้

## 17. Verification Commands

- Database: PASS — migrate ซ้ำ, seed, migrate หลัง seed
- Backend Tests: PASS — 23/23
- Frontend Tests: PASS — 7/7
- Integration/E2E: PASS — HTTP integration แบบ user1/user2/admin1
- Lint: PASS
- Build: PASS
- Health: PASS — production HTTP 200
- Production SPA: PASS — `/dashboard/upload` HTTP 200 และมี app root

## 18. Remaining Issues

- Screenshot visual QA เป็น NOT RUN เพราะ browser connector ไม่พร้อมใช้งาน
- SQLite BLOB เหมาะกับขนาดปัจจุบัน แต่ควรประเมิน object storage เมื่อขยายระบบ
- Admin rejection ทั่วไปยังใช้ `window.prompt`; ควรเปลี่ยนเป็น modal ในงาน UX รอบถัดไป
- Course เก่าที่ map code ไม่ได้ต้องให้ผู้ดูแลตรวจ metadata ก่อน production

## 19. Deploy Readiness

สถานะ: **พร้อม Deploy แต่ต้องตั้งค่าเพิ่มเติม**

เหตุผล: migration, tests, lint, build, production startup, authenticated API, health และ SPA fallback ผ่าน ต้องตั้ง `NODE_ENV=production`, `JWT_SECRET`, `DATABASE_PATH` บน persistent writable storage, HTTPS และ `ALLOWED_ORIGINS` ให้ตรง environment จริง พร้อมสำรองฐานข้อมูลก่อน migration
