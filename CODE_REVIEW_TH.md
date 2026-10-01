# Code Review

วันที่ตรวจ: 15 กันยายน 2026 — ปรับปรุง CSIT Sheet บนระบบเดิมตาม master prompt ปัจจุบัน ผล PASS ด้านล่างอ้างอิงคำสั่งและเบราว์เซอร์ที่รันจริงใน session นี้

## 1. สรุปภาพรวม

ปรับ Starter ใหม่ด้วย Thai editorial hero, labelled product preview, Bento, marquee, dark contribution section, community steps และ CTA ปรับ design tokens ทั้ง Starter/Auth/User/Admin เป็นพื้นกลาง ปุ่มดำ และม่วงจำกัด พร้อมแก้ async preview/profile race, stale typed-catalog SPA navigation, approval confirmation, pending duplicate file comparison, metadata BLOB projection และ CSP ที่บล็อก preview

ระบบ Vue/Router/stores/API/Express/SQLite/auth/upload/publication/contribution/storage เดิมยังอยู่ ไม่มีแอปใหม่ ไม่มี static HTML replacement และไม่มี dependency ใหม่ ข้อมูลทดสอบอยู่ในฐาน SQLite และ browser profile ชั่วคราว ไม่ seed หรือ reset ฐานข้อมูลจริง

## 2. Architecture เดิมที่พบ

npm workspaces; Vue 3.5, Vite 6, Vue Router, Axios; reactive auth/notification stores; Express 5 controllers/routes/middleware/services/repositories; SQLite ผ่าน node:sqlite; access JWT และ rotated refresh cookie; role/ownership guards

UploadRequest เป็น submission source of truth ขณะ publication เขียนลง Lecture/Sheet ตาม structured type และ public document repository รวม approved records สำหรับ Home/hierarchy/search/files/impact

## 3. สิ่งที่เลือก Reuse

ใช้ auth/refresh/logout/password migration, USER/ADMIN navigation, document/course hierarchy, upload validation/dropzone/history, shared UserIdentity/StatusBadge/ConfirmDialog, contributor APIs/profile, Helpful/score/levels/badges, duplicate classifier, FileAsset dedup/cleanup และ transaction/idempotency เดิม

คง canonical `Lecture`/`Sheet` และ workflow status เดิม การแสดงภาษาไทยไม่เปลี่ยน enum ใน DB/API ผู้แบ่งปันไม่ได้ถูกเรียกว่า copyright owner

## 4. สิ่งที่ Refactor

- เปลี่ยน semantic tokens โดยรักษา class contracts และ components เดิม
- key nested user RouterView ด้วย fullPath เพื่อให้ shared typed catalogs/course/year routes เริ่มข้อมูลใหม่เมื่อเปลี่ยนหน้า
- discard preview/profile responses ที่หมดอายุหรือมาถึงหลัง unmount พร้อม revoke object URLs
- ยืนยัน approval เช่นเดียวกับ rejection และจับ request ID ก่อนตัดสินใจ ป้องกัน busy/repeated decisions
- แยก contributor downloads/votes CTE เพื่อลดจำนวนแถวที่ถูกคูณ และตัด legacy self rows ออกจาก reward
- explicit projection ของ upload metadata แทน SELECT request.* ที่มี BLOB
- รับ @username ใน UI search โดยนำ @ ออกเฉพาะ contributor query

## 5. Database / Migration

รอบนี้ไม่เพิ่ม schema ใช้ migration/display_name backfill/index ที่มีอยู่แล้ว รัน migration สองครั้งบน fresh isolated DB ผ่าน `integrity_check=ok` และ foreign-key violations 0 Backend test ยืนยัน display-name migration idempotency และข้อมูลเดิมไม่ถูก reset

Production smoke ใช้ temp DB แยกอีกชุด ไม่ใช้ข้อมูลจริง ไม่มี production seed ใหม่

## 6. Design System

ใช้ #FCF8FA background, #F8F9FA/#F6F3F4/#FFFFFF surfaces, #111827/#4B5563 text, #E5E7EB borders และ #000000 primary action ม่วง #8B5CF6 ใช้จำกัด โดยข้อความม่วงใช้ #6D28D9 ที่อ่านชัดกว่า; #10B981 positive signal และ #0058BE link; muted text #687280

Dark feature surfaces ใช้ #0B0D11/#13161C/#1C2029 พร้อม border #27272A Cards ส่วนใหญ่เป็นกลาง สถานะ success/warning/danger มีข้อความกำกับ

Typography: Leelawadee UI/Tahoma/Noto Sans Thai/Arial; Thai heading line-height 1.4 ขึ้นไป/body 1.65; Cascadia Code/Consolas เฉพาะ technical labels/ตัวเลข Spacing ใช้ 4–64px scale; radius/control/border/shadow อยู่ใน tokens; controls 44px; shadow เบา; glyphs/SVG เดิม ไม่เพิ่ม icon CDN ภาษา root document เป็น th

## 7. Starter Page

Hero ใช้ข้อความ “ค้นหา แบ่งปัน และส่งต่อความรู้.” พร้อม Browse/Share destinations ที่ตรวจ anonymous/USER/ADMIN แล้ว Product Demo เป็นภาพสาธิตแนวคิดซึ่งระบุชัด ไม่สร้างเอกสาร/ผู้ใช้/สถิติปลอม และไม่เป็น functional app ซ้อน

Bento แสดง discovery/share/Lecture/Sheet/contributors; marquee แสดง vocabulary ของผลิตภัณฑ์; dark section อธิบายคุณค่าผู้แบ่งปัน; community loop และ footer/CTA ใช้เรื่องราวที่เกี่ยวกับ CSIT เท่านั้น ไม่มี pricing/billing/testimonials/cookie banner/language toggle ที่ไม่จำเป็น

ไม่มี anonymous aggregate API จึงใช้ non-numeric communication แทน Metrics ปลอม Autonomous CSS typing/results/Helpful/marquee และ viewport reveal มีปุ่ม pause และ reduced-motion/static fallback Preview animation หยุดเมื่ออยู่นอก viewport และ observer ถูก disconnect ขณะ unmount ไม่แก้ค่า input จริง

เลิก import hero PNG เดิมประมาณ 2.1MB จึงไม่ emit ไฟล์ดังกล่าวใน production Starter bundle ใหม่

## 8. User UX/UI

Home, Lectures, Sheets, Course/year/semester/documents, Search, Upload/history และ Profile ใช้ design tokens เดียวกัน คงห้ารายการ navigation พร้อม Search shortcut/mobile menu

Home รวมทั้งสองประเภท Typed catalog ใช้ metadata เท่านั้นและโหลดใหม่เมื่อ SPA เปลี่ยนประเภท ปี/ภาคเรียน/counts เป็นข้อมูลจริง Document actions ใช้ authoritative document/file เดียวกัน ทั้ง view/download/Helpful Contributor links/impact และ long Thai/English strings ตรวจผ่าน fixture และภาพจริง

Login/Register รักษาฟอร์มและ validation เดิมแต่เปลี่ยนตามธีมใหม่ ไม่ใส่ autonomous motion รอบ fields

## 9. Public Contributor

คง `/dashboard/users/:username` และ authenticated contributor search/profile API ตาม permission model เดิม Public หมายถึง visible-to-authenticated-users ไม่เปิด anonymous browsing เพิ่มโดยพลการ

แสดง display name/username/avatar/recognition/public counts/approved documents ผ่าน whitelist ไม่แสดง email/password/token/private account/security metadata หรือ pending/rejected uploads Shared identity มี avatar/initial fallback และ route link จริง Search รองรับ exact/partial/case-insensitive username/displayName พร้อม @ ใน UI

Profile generation guard ป้องกันข้อมูลจาก route ก่อนหน้าทับ route ใหม่ Privacy assertions ผ่าน Backend integration

## 10. Contribution System

คง server-derived rules: rewardable completed contribution 20, unique non-owner download 2, non-owner Helpful 5, View 0 หนึ่ง submission นับ contribution ครั้งเดียว ไม่รวม request + public record เป็นสองรายการ

Helpful ใช้ DB uniqueness และ idempotent toggle; self-vote ถูกปฏิเสธ การดาวน์โหลดซ้ำไม่เพิ่ม qualified reward ซ้ำ Levels/badges derive จาก authoritative data และไม่เพิ่ม permissions Duplicate/rejected contributions ไม่ได้ publication points

Aggregate test: 2 publications + 4 qualified downloads + 6 Helpful = 78 points; search/profile reconcile ตรงกัน และ legacy self rows ไม่เพิ่ม score Browser E2E ยืนยัน Helpful +5 และดาวน์โหลดสองครั้งรวม +2

## 11. Duplicate Detection

คง precedence EXACT_DUPLICATE → supported CONTENT_DUPLICATE → POSSIBLE_DUPLICATE → NONE Server SHA-256 ไม่ถูกหลบด้วยการเปลี่ยน filename ตรวจทั้ง pending และ published records; metadata possible match ต้องมี normalized title และ Admin เป็นผู้ตัดสิน ไม่ใช้ hierarchy อย่างเดียว

Backend integration ผ่าน exact/content/possible/pending, renamed binary, distinct same-semester files, duplicate reward protection และ retry ไม่มีเปอร์เซ็นต์ similarity ปลอม Admin เปิด pending match ผ่าน ADMIN request-file API และ published match ผ่าน approved document API

Content fingerprint รองรับ plain text/simple extractable PDF แบบ bounded/conservative เท่านั้น Compressed/encrypted/image-only/complex PDFs และ unsupported extraction fallback อย่างปลอดภัย จึงไม่อ้าง universal semantic duplicate detection

## 12. Storage Deduplication

ใช้ `file_assets(binary_hash UNIQUE)` เป็น canonical bytes Requests/public file rows อ้าง reference เดียว Publication ไม่ copy BLOB มี delete-protection trigger และ cleanup ลบเฉพาะ orphan

Existing integration ผ่าน shared-asset reuse, reject duplicate โดย count/score ไม่ inflate, reference safety และ orphan cleanup Queue/search/profile โหลดเฉพาะ metadata ขณะ file serving/extraction เท่านั้นที่โหลด bytes

## 13. Admin UX/UI

คง Dashboard แบบ action-needed, pending queue, preview/metadata/contributor workspace, duplicate comparison และ sticky decision bar Responsive เป็น stacked layout; mobile actions wrap โดยมีพื้นที่ให้ข้อความและ touch targets

Approval/Reject/Reject Duplicate ผ่าน ConfirmDialog จับ request ID และป้องกัน selection/refresh ระหว่างตัดสินใจ Rejection ต้องมีเหตุผล bounded ส่งกลับ uploader; success status ชัดเจนและเลือก pending item ถัดไป

Preview race test ใช้ slow A/fast B และพิสูจน์ว่า iframe B ไม่ถูก response A ทับ Preview bytes จริงและ pending duplicate actions ผ่านเบราว์เซอร์ ไม่ใช่เพียง API 200

## 14. Security

รักษา scrypt password migration, signed short-lived access JWT, refresh rotation/revocation/HttpOnly/Secure/SameSite, role/ownership, rate limiting, explicit CORS, prepared SQL, safe filename/path/size/MIME/signature checks และ safe file headers เดิม

พบและแก้ production CSP ที่บล็อก Blob iframe ด้วย `frame-src 'self' blob:` เท่านั้น ไม่เปิด arbitrary frame sources หรือ unsafe-inline scripts Backend CSP assertions ผ่าน; final browser security logs ไม่มี CSP error

`npm.cmd audit --omit=dev` ผ่าน: 0 production vulnerabilities ข้อนี้ไม่ใช่การรับรองว่าไม่มีช่องโหว่เชิงตรรกะทุกประเภทในระบบ

## 15. Accessibility

มี semantic main/nav/heading/form/button, associated labels, th document language, Starter skip link, visible focus/dropzone focus, non-color status text, Helpful pressed state, menu expanded/control IDs และ Escape

Upload tabs มี tab/panel relation, roving tabindex และ Arrow/Home/End พร้อม focus verification Dialog ทดสอบ Tab ไป confirm, Escape ปิดและคืน focus ที่ trigger จริงในทุก viewport ปุ่ม pause และ prefers-reduced-motion ทำงานจริง ไม่อ้าง exhaustive screen-reader certification

## 16. Responsive QA

| Width | Result | Evidence |
|---|---|---|
| 375 | PASS | mobile menu, stacked forms/cards/review/actions, long strings, dialog/preview |
| 768 | PASS | tablet grids, upload layout, stacked Admin review, dark section |
| 1024 | PASS | navigation/breakpoint, discovery/forms/profile/review |
| 1440 | PASS | desktop hero/workspace/duplicate comparison และ 3-actor browser lifecycle |

Final Edge run: 89 screenshots / 85 checks, overflow bounds 0, runtime/security errors 0 ภาพ inspected แยกจาก assertions รวม settled dialog, file preview, Starter light/dark และ long strings ผลนี้จำกัดอยู่ใน Chromium/Edge และ fixtures ที่รัน ไม่ใช่ cross-browser certification

Artifacts อยู่ `artifacts/visual-qa/report.json` และ PNGs ใน directory เดียวกัน ซึ่งถูก gitignore และไม่เข้า runtime

## 17. Automated Tests

- Backend: PASS 30/30 รวม auth/material publishing/migration/privacy/duplicate/storage/score และ aggregate reconciliation
- Frontend: PASS 19/19 ใน 13 files รวม real memory-router typed navigation, Admin preview race/confirmation/pending evidence, Starter pause/auth routes/observer และ keyboard Upload tabs
- Lint: PASS
- Production build: PASS 118 modules; JS ประมาณ 254KB / gzip 83KB, CSS ประมาณ 41.5KB / gzip 8.6KB
- Migration twice/integrity/FK: PASS บน isolated DB
- Browser visual/keyboard/lifecycle: PASS

## 18. 3-Actor E2E

Backend suite ใช้ user1/user2/admin1 ผ่าน HTTP กับ isolated SQLite ครอบคลุม Lecture/Sheet publication, privacy, filters, view/download, contributor search/profile, Helpful/self/repeat rules, duplicates/storage และ approval retry

เพิ่ม browser lifecycle ที่ 1440: user1 เลือกไฟล์ text จริงผ่าน native file input และส่งฟอร์ม → history PENDING → user2 ค้นไม่พบ → admin1 เลือกรายการ/ตรวจ preview/confirm approval → DB มีหนึ่ง public Sheet → user2 ค้นพบหนึ่งรายการ → กด contributor link เข้า profile → Helpful +5 → ดาวน์โหลดจาก UI สองครั้งรวม score +2

Browser actors ใช้ valid fixture refresh sessions เป็น setup; password login/refresh/logout ถูกพิสูจน์ใน Backend tests แยก ไม่มี test-only hooks ใน runtime Lifecycle report เป็น PASS และมี pending/private/approved/discovered/impact screenshots

## 19. Regression

Auth/role/ownership, Home/hierarchy, Lecture/Sheet filters, Upload/My Uploads, own/public Profile, contributor search, view/download, Helpful/score/levels/badges, exact/content/possible/pending duplicates, shared storage/cleanup และ Admin approval ผ่าน automated regression กับ browser checks

ไม่ลบ API/feature เดิม ไม่เปลี่ยน domain enum ไม่เพิ่มแอปใหม่ ไม่ reset ฐานข้อมูลจริง Approval transaction/retry และ contribution count semantics เดิมผ่านต่อเนื่อง

## 20. Commands Actually Executed

| Command / Check | Final result |
|---|---|
| `npm.cmd test` | PASS: Backend 30 + Frontend 19 |
| `npm.cmd run test:backend` | PASS หลังแก้ fixture created_at; suite รวมผ่านอีกครั้ง |
| `npm.cmd run test:frontend` | PASS; navigation/mock/keyboard tests รวมผ่าน |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS final production assets |
| `npm.cmd run test:visual` | PASS: 89 screenshots / 85 checks + browser 3 actors |
| `node backend/src/data/migrate.js` ใน QA runner | PASS สองรอบต่อ fresh DB |
| `PRAGMA integrity_check` / `foreign_key_check` | PASS: ok / 0 |
| `npm.cmd run start:production` | PASS temp DB, backend server.js port 8099 |
| `Invoke-WebRequest` health/root/nested SPA route | PASS HTTP 200 ทั้งสาม |
| built JS request พร้อม Origin header | PASS HTTP 200, text/javascript |
| `npm.cmd audit --omit=dev` | PASS: 0 vulnerabilities |
| `node --check scripts/visual-qa.mjs` / `git diff --check` | PASS |

ช่วงแรก `npm test` แบบ PowerShell command ถูก execution policy บล็อก จึงใช้ npm.cmd ตาม environment โดยไม่เปลี่ยน system policy มี intermediate failures ที่แก้จริง: fixture required timestamp, isolated CORS origin, sandbox renderer startup, Blob CSP และ synthetic-click focus setup ไม่ใช้ผลล้มเหลวเหล่านี้มาอ้าง PASS จน final run ผ่าน

Typecheck: NOT RUN — repository JavaScript ไม่มี typecheck script Full npm audit: NOT RUN ในรอบนี้; production dependency audit รันแล้ว ไม่อ้างผล full/dev audit เก่าจากรอบก่อน Real-database migration/seed: NOT RUN เพราะตรวจแบบ isolated และไม่จำเป็นต้องแก้ schema/ข้อมูลจริง

## 21. Remaining Issues

ไม่มี blocker ที่พบจาก checks ที่รัน ข้อจำกัดจริง: content fingerprint ไม่รองรับ PDFs ทุกชนิด; native preview ของ Office ขึ้นกับ browser/file type; browser matrix ใช้ Edge และ text preview fixture ไม่ใช่ทุก OS/native PDF viewer หรือ assistive technology

Visual QA ต้องมี installed Chromium/Edge และ OpenSSL; host อื่นตั้ง executable paths ได้ Restricted sandbox อาจต้องอนุญาต renderer process นอก sandbox Artifacts/test certificates/sessions เป็น isolated development evidence และไม่ควรใช้เป็น production credentials

## 22. Deploy Readiness

พร้อม Deploy แต่ต้องตั้งค่าเพิ่มเติม

อัปเดตการ deploy วันที่ 2026-10-02: production ใช้ Netlify-only ตาม `DEPLOYMENT.md` โดยใช้ Netlify Database, site-wide Netlify Blobs และ Netlify Functions ไม่ใช้ `DATABASE_PATH`, persistent SQLite disk หรือ Render อีกต่อไป ต้องตั้ง `JWT_SECRET` ใน Netlify และห้าม commit credentials

ไม่มีการ deploy/publish หรือแก้ข้อมูลจริงในงานนี้
