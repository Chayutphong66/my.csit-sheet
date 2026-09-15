# Code Review

## 1. สรุปภาพรวม

CSIT Sheet ถูกต่อยอดใน repository เดิมเป็นแพลตฟอร์มแบ่งปันความรู้แบบ Thai-first โดยคง flow เดิมทั้งหมดและเพิ่ม public contributor discovery ที่ปลอดภัย ฝั่งผู้ใช้ได้ shell, discovery, cards, upload/history, own/public profile และ unified search ใหม่ ฝั่ง Admin เปลี่ยนจากตาราง action หนาแน่นเป็น Dashboard -> Queue -> Approval Workspace ที่โฟกัสทีละรายการ

## 2. Architecture ที่พบ

คง Vue 3/Vite/Vue Router/Axios, Express 5, SQLite, JWT cookie/session, role/ownership middleware, repository/controller/service boundaries และ npm workspaces ไว้ `upload_requests` ยังเป็น submission source of truth และ Lecture/Sheet ยังแยก write model แต่ใช้ unified approved-document read model ร่วมกัน

เพิ่ม contributor read model โดยไม่สร้าง document หรือ contribution system คู่ขนาน ใช้ aggregate SQL แบบ set-based และ DTO whitelist สำหรับข้อมูลสาธารณะ

## 3. UX/UI Renovation

สร้าง Design System กลางใน `styles.css` ครบ semantic colors, Thai-capable typography, spacing, radius, border, shadow, icon/control size, layout width, breakpoints และ motion เปลี่ยนเป็นพื้น cream, near-black text, lime accent และ soft lavender/yellow/peach/green แบบจำกัด

แรงบันดาลใจจาก Passionfroot ถูกแปลงเป็นพื้นผิวโค้งมน จังหวะ whitespace ชัด คนและ metrics เป็น first-class object และ workflow ที่เริ่มจาก action โดยไม่คัดลอก logo, asset, copy หรือ layout แบบตรงตัว อ้างอิง public site/gallery/storefront/workspace guides ที่ระบุใน `AUDIT.md`

Card, form, tabs, status, empty/loading/error, dialog, navigation และ admin workspace ใช้ visual language เดียวกัน Hover/press/dialog/menu/skeleton ใช้ motion 160–240ms และ reduced motion ปิด motion ที่ไม่จำเป็น

## 4. ภาษาไทย / English

Navigation, actions, forms, search, upload history, profile, admin queue, dialog และ states ใช้ภาษาไทยเป็นหลัก คำอย่าง Username, Admin, Badge, Preview, metadata, Exact/Content/Possible Duplicate คง English ในบริบทที่ชัดกว่า มี presentation mapping กลางสำหรับ document type, request status และ duplicate status โดย backend enums ไม่ถูกแปลหรือเปลี่ยนค่า

## 5. User Experience

- Home: hero ชุมชน + course discovery และ dynamic approved counts
- Lectures/Sheets: ใช้ hierarchy/API เดียวกันแต่ filter ตามชนิดอย่างชัดเจน
- Course/Year/Semester: ใช้ข้อมูลจริง ไม่ hard-code ปีหรือภาคเรียน
- Search: query เดียว แยก “ผู้แบ่งปัน” และ “เอกสาร”
- Upload: form + drag/drop + validation + success/error และ history อยู่หน้าเดียวกัน
- Profile: แยกข้อมูลบัญชีส่วนตัวออกจาก impact/recognition พร้อมลิงก์โปรไฟล์สาธารณะ

Primary navigation ยังมีเพียง หน้าหลัก, เอกสารการสอน, ชีทสรุป, อัปโหลด, โปรไฟล์ และ Search อยู่ใน topbar/mobile menu ไม่มี My Upload Requests แยกกลับมา

## 6. Contributor Ecosystem

เพิ่ม `display_name` พร้อม fallback username และ reusable `UserIdentity` ที่แสดง avatar/initial, display name และ `@username` Document cards เชื่อมไป `/dashboard/users/:username`

API `GET /api/contributors/search?q=` ค้น username/display name แบบ partial case-insensitive และจำกัด 20 รายการ API `GET /api/contributors/:username` ส่งเฉพาะ identity, level, public summary, badges และ approved documents โปรไฟล์สาธารณะไม่ส่ง email, password, token, role, pending/rejected request หรือ internal uploader ID

Analytics, Helpful, Score, Level และ Badges ใช้ข้อมูล authoritative เดิม คะแนนยังคำนวณจาก unique approved contribution 20, qualified unique non-owner download 2, active non-owner Helpful 5 และ View 0 ไม่มีค่าที่ client แก้ได้

## 7. Duplicate System

คง classifier เดียวและ precedence `EXACT_DUPLICATE -> CONTENT_DUPLICATE -> POSSIBLE_DUPLICATE -> NONE` ตรวจทั้ง PENDING requests และ APPROVED documents SHA-256 มาจาก bytes ฝั่ง server จึงเปลี่ยน filename เพื่อหลบไม่ได้ Content fingerprint รองรับ plain text/simple text PDF ที่ extract ได้อย่างมั่นใจ ส่วนไฟล์ซับซ้อน fallback อย่างปลอดภัย Same hierarchy อย่างเดียวไม่ถือว่าซ้ำ

รายการซ้ำไม่เผยแพร่ ไม่เพิ่ม public count และไม่รับ contribution reward Admin เห็น New vs Existing, binary/content signal และเลือก Reject as Duplicate ผ่าน confirmation dialog

## 8. Storage Deduplication

`file_assets.binary_hash` เป็น canonical binary ที่ unique Request, LectureFile และ SheetFile อ้าง asset เดียวกัน Publication เพิ่ม reference โดยไม่ copy BLOB มี trigger ป้องกันการลบ asset ที่ถูกอ้าง และ cleanup ลบเฉพาะ orphan

Storage report ของฐาน runtime หลัง migration: `integrity=ok`, foreign-key violations 0, asset 1 รายการ/242665 bytes, request reference 1, sheet reference 1 และ legacy payload 0

## 9. Admin Renovation

Admin root เปิด Dashboard “สิ่งที่ต้องดำเนินการ” เป็นค่าเริ่มต้น มี pending CTA, metrics และ review guidance Queue แสดง summary และมี action หลัก “ตรวจสอบ” หนึ่งรายการต่อ card

Approval Workspace มี preview ในบริบท, metadata, contributor, duplicate comparison และ sticky Approve/Reject/Reject Duplicate bar บน desktop; responsive จะ stack บนหน้าจอแคบ Reject ใช้ custom alert dialog พร้อมเหตุผล, Escape, focus trap และคืน focus แทน `window.prompt`

หน้า Users และ Academic Structure ถูกปรับให้เป็น read-only management views ที่ใช้งานได้ตาม API จริง โดยไม่สร้าง CRUD contract ที่ backend ยังไม่มี

## 10. Database / Migration

เพิ่ม `users.display_name TEXT NOT NULL DEFAULT ''` แบบ idempotent, backfill ค่าว่างจาก username และ index `idx_users_public_identity` สำหรับ lowercase username/display name lookup Fresh seed และ registration ใส่ display name ได้ Existing data, file assets และ foreign keys ไม่ถูกทำลาย

รัน migration ฐาน runtime สองรอบสำเร็จ และ `PRAGMA foreign_key_check` ผ่านใน integration suite

## 11. Security

Contributor routes ต้อง authenticate และ validate username รูปแบบ/ความยาว Search จำกัด query 100 ตัวอักษรและผลลัพธ์ 20 รายการ Query ใช้ prepared statements และไม่ select BLOB DTO ใช้ whitelist/destructure ก่อนตอบ Public profile ไม่เปิดข้อมูลบัญชีหรือ workflow ส่วนตัว

Role/ownership, pending/rejected file protection, approved-only public document resolution, server-authoritative score, Helpful uniqueness/self-vote protection, qualified interaction uniqueness, Helmet, CORS, upload MIME/signature/size validation และ `nosniff` เดิมยังทำงาน

`npm audit --omit=dev` พบ 0 production vulnerabilities ส่วน full audit พบ moderate 2 รายการใน Vitest/@vitest-mocker ฝั่ง development; ไม่ใช้ `audit fix --force` เพราะต้องอัปเกรด Vitest major version

## 12. Accessibility

เพิ่ม semantic nav/search/heading/form/button, visible focus, status ที่มี text + dot ไม่พึ่งสี, label สำหรับช่องค้น/ฟอร์ม, touch target 44px, `aria-pressed` สำหรับ Helpful/queue, `aria-expanded` สำหรับ menu/details และ dialog แบบ `alertdialog` พร้อม labelled/described relation, Escape, focus trap และ focus restoration

สีข้อความและ action ใช้ near-black/dark semantic foreground บนพื้นอ่อน ปุ่ม danger ใช้ทั้งข้อความและรูปแบบ และรองรับ `prefers-reduced-motion`

## 13. Responsive / Visual QA

Responsive implementation รองรับ layout targets 375/768/1024/1440 ผ่าน mobile-first wrapping, collapsing grids, mobile menu, stack admin workspace, reachable action bar, `min-width: 0`, `overflow-wrap:anywhere`, flexible buttons และ table overflow เฉพาะกรณีจำเป็น Automated source assertions ผ่าน

- 375: NOT RUN ใน real browser
- 768: NOT RUN ใน real browser
- 1024: NOT RUN ใน real browser
- 1440: NOT RUN ใน real browser

เหตุผล: browser skill มีอยู่แต่ runtime `node_repl`/browser connection ไม่ถูกเปิดใน session นี้ จึงไม่สร้างผล visual PASS หรือ screenshot ปลอม

## 14. Automated Tests

- Backend: PASS 29/29
- Frontend: PASS 12/12 ใน 10 test files
- Lint: PASS
- Build: PASS, Vite 119 modules
- Migration/integrity: PASS
- Production HTTP smoke: PASS

Frontend tests ครอบคลุม Thai navigation, course hierarchy, upload/history, own profile, clickable contributor impact, unified search, public profile, admin duplicate workspace/dialog และ design-token/responsive/reduced-motion source contracts

## 15. 3-Actor E2E

Integration suite ใช้ `user1`, `user2`, `admin1` ผ่าน HTTP API จริงกับ isolated SQLite fixture ครอบคลุม unique Lecture/Sheet upload, pending privacy, approval, discovery, typed catalogs, public contributor click destination data, username/partial display-name search, public profile privacy, Helpful toggle/self rejection, repeated download anti-abuse, exact/content/possible/pending duplicate, storage reuse, duplicate score protection และ approval retry idempotency

Scenario public contributor ใหม่ยืนยันว่า `user2` ค้น “USER1” และ partial Thai display name พบ `user1`, เปิด profile ได้เฉพาะข้อมูล safe และ document DTO แสดง display name/username/avatar field ถูกต้อง

## 16. Regression

Authentication/authorization, Home, Course, Year, Semester, Lectures, Sheets, Upload, My Uploads, Own Profile, Search, View, Download, Admin Approval, duplicate detection, storage dedup, Helpful, contribution score, levels และ badges ผ่าน automated regression/integration suite ไม่มี API เดิมถูกลบ

## 17. Commands Executed

- `npm.cmd run lint` — PASS
- `npm.cmd run build` — PASS
- `npm.cmd run test:backend` — PASS 29/29
- `npm.cmd run test:frontend` — PASS 12/12
- `npm.cmd test` — PASS 41 tests รวม
- `npm.cmd run db:migrate` — PASS สองรอบ
- `npm.cmd run db:storage-report` — PASS, integrity ok/FK 0
- `npm.cmd run start:production` — PASS บน port 8099 ด้วย temp production DB
- `Invoke-WebRequest` `/api/health`, `/`, `/dashboard/users/user1` — PASS HTTP 200
- `npm.cmd audit --omit=dev` — PASS, 0 vulnerabilities
- `npm.cmd audit` — exit 1 จาก moderate development-only 2 รายการ

## 18. Remaining Issues

- Visual QA ด้วย browser จริงที่ 375/768/1024/1440 ยัง NOT RUN เพราะ browser runtime ไม่พร้อม จึงยังต้องตรวจ spacing, Thai font rendering, preview embedding, long pathological strings และ motion ด้วยตา
- Vitest/@vitest-mocker มี moderate development-only advisories 2 รายการ การแก้ต้องอัปเกรด major และควรทำเป็น dependency ticket แยก
- PDF content fingerprint ตั้งใจรองรับเฉพาะ plain/simple extractable text; compressed, encrypted, image-only และ complex PDFs fallback ไป exact/metadata checks
- ไฟล์ hero PNG เดิมใน production bundle มีขนาดประมาณ 2.1 MB ควร optimize ในรอบ performance asset ถัดไป

## 19. Deploy Readiness

ยังไม่พร้อม Deploy

โค้ด, migration, privacy, integration, lint, build และ production smoke ผ่าน แต่ master acceptance บังคับ real-browser visual QA และห้ามรายงาน PASS โดยไม่ได้รัน จึงต้องทำ visual matrix ให้ครบก่อนเปลี่ยนสถานะ deploy นอกจากนี้ production ต้องตั้ง `NODE_ENV`, `JWT_SECRET`, persistent `DATABASE_PATH`, `ALLOWED_ORIGINS` ตาม topology จริง และ backup SQLite ก่อน migration
