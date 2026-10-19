# R1 owner-controlled release gates

Prepared: 2026-10-19

This package records evidence still required from the Owner or an authorized operator. It does not authorize commit, push, CI dispatch, merge, migration or deployment.

## 1. Production SMTP/TLS verification

Status: **PENDING PRODUCTION VERIFICATION**

Do not record usernames, passwords, access tokens or connection strings in this document.

Authorized operator checklist:

- [ ] SMTP provider name recorded: ______________________________
- [ ] Configured SMTP host verified without revealing credentials
- [ ] Port recorded: __________
- [ ] TLS mode recorded: `implicit TLS` / `STARTTLS`
- [ ] Port 465 uses `SMTP_SECURE=true` and implicit TLS, if port 465 is selected
- [ ] Submission port 587 or another STARTTLS port uses `SMTP_SECURE=false`; application sets `requireTLS=true`
- [ ] Provider documentation confirms TLS support for the selected host/port
- [ ] Certificate verification is enabled
- [ ] No `rejectUnauthorized: false` or equivalent bypass exists
- [ ] No plaintext fallback is allowed
- [ ] Authentication is SMTP username/password only; OAuth2 is not configured
- [ ] Transport is operator-controlled and single-tenant; users cannot select host, sender or transport
- [ ] Production sender contains no CR/LF and matches the authorized provider/domain policy
- [ ] Verification date/time and timezone: ________________________
- [ ] Verifier name or organizational identity: __________________
- [ ] Evidence reference or ticket (secret-free): _________________

Acceptance result: `PASS` / `FAIL` / `NOT VERIFIED`

Any failure or missing evidence keeps the Production release blocked.

## 2. Privacy P2 approval package

Status: **PENDING OWNER CONTENT APPROVAL**

Proposed notice version: `2026-10-19.1`

Proposed effective date: **PENDING OWNER DECISION**

### Exact first-visit notice

**ข้อมูลการใช้บริการและความเป็นส่วนตัว**

ระบบใช้ข้อมูลบัญชี เอกสาร กิจกรรมการใช้งาน และข้อมูลที่จำเป็นต่อการยืนยันตัวตน เพื่อให้บริการค้นหา แบ่งปัน ตรวจสอบเอกสาร และรักษาความปลอดภัย การกด “รับทราบ” ใช้เพื่อปิดข้อความนี้และไม่ถือเป็นการให้ความยินยอมทางกฎหมาย

Link: `อ่านรายละเอียดความเป็นส่วนตัว`

Button: `รับทราบ`

### Exact privacy information page

ข้อมูลความเป็นส่วนตัว

#### ข้อมูลการใช้บริการและความเป็นส่วนตัว

สถานะเนื้อหา: รอการอนุมัติจากเจ้าของระบบ · เวอร์ชันที่เสนอ 2026-10-19.1

เนื้อหานี้อธิบายการทำงานที่ตรวจสอบได้จากระบบ ไม่ใช่การขอความยินยอมทางกฎหมาย และยังไม่ใช่นโยบายความเป็นส่วนตัวฉบับที่ได้รับอนุมัติ

วันมีผล: รอการยืนยันจากเจ้าของระบบ

#### ข้อมูลที่ระบบใช้

- ข้อมูลบัญชีและโปรไฟล์ เช่น username, email, ชื่อที่แสดง สาขา รุ่น ประวัติสถานะบัญชี และค่าการเปิดเผยโปรไฟล์
- ข้อมูลยืนยันตัวตนและเซสชัน ได้แก่รหัสผ่านที่จัดเก็บแบบ hash, access token ในหน่วยความจำของเบราว์เซอร์, refresh token ในคุกกี้ HTTP-only และข้อมูลการเพิกถอนเซสชัน
- ไฟล์ที่อัปโหลด metadata ของเอกสาร ประวัติการส่งตรวจ การอนุมัติหรือปฏิเสธ เวอร์ชันเอกสาร การดู และการดาวน์โหลด
- กิจกรรมชุมชน เช่น favorite, helpful vote, collection, การติดตามผู้ใช้ และการตั้งค่าการแจ้งเตือน
- รายงานปัญหาและข้อเสนอแนะ หน้าอ้างอิง สถานะ และข้อความตอบกลับจากผู้ดูแล หมายเหตุภายในของผู้ดูแลไม่ถูกส่งกลับในมุมมองของผู้รายงาน
- สถานะการส่งอีเมลเมื่อเปิดใช้บริการอีเมล และข้อมูลการรับทราบข้อความนี้ที่เก็บในเบราว์เซอร์เฉพาะ version กับ acknowledgedAt

#### วัตถุประสงค์ที่ตรวจสอบได้

ระบบใช้ข้อมูลเพื่อสร้างและรักษาบัญชี ยืนยันตัวตน ให้บริการค้นหาและแบ่งปันเอกสาร ตรวจสอบและเผยแพร่เนื้อหา แสดงกิจกรรมชุมชน ป้องกันการเข้าถึงที่ไม่ได้รับอนุญาต ส่งการแจ้งเตือนที่เปิดใช้ และติดตามการแก้ปัญหาที่ผู้ใช้แจ้ง

#### การจัดเก็บและโครงสร้างพื้นฐาน

โหมดพัฒนาในเครื่องรองรับ SQLite และพื้นที่เก็บไฟล์ภายในเครื่อง ส่วนการติดตั้งจริงที่ตรวจสอบในการเตรียม release กำหนดให้แอปพลิเคชันทำงานบน Railway ใช้ Supabase PostgreSQL และใช้ object storage ตามค่าติดตั้ง หากเปิดบริการอีเมล ที่อยู่อีเมลและผลการส่งจะผ่านผู้ให้บริการ SMTP ที่ผู้ดูแลกำหนด รายละเอียดผู้ให้บริการ ที่ตั้งข้อมูล ระยะเวลาเก็บรักษา และกลไกการโอนข้อมูลยังต้องได้รับการยืนยันจากเจ้าของระบบก่อนเผยแพร่

#### การควบคุมของผู้ใช้

ผู้ใช้แก้ไขโปรไฟล์ เลือกการเปิดเผยโปรไฟล์ สาขา และรุ่น ตั้งค่าการแจ้งเตือน จัดการกิจกรรมบางประเภท และออกจากระบบได้ การลบหรือส่งออกข้อมูลทั้งบัญชียังไม่มี workflow ที่ยืนยันได้ในระบบปัจจุบัน

#### การเก็บรักษาและความปลอดภัย

ระบบกำหนดอายุและการเพิกถอน refresh token และรองรับการปิดใช้งานบัญชี แต่ยังไม่มีตารางระยะเวลาเก็บรักษาและการลบข้อมูลอัตโนมัติที่ครอบคลุมทุกประเภท การเข้าถึง API ใช้ authentication, role checks และการตรวจ ownership ตามฟังก์ชันที่เกี่ยวข้อง อย่างไรก็ตามไม่มีระบบใดรับประกันความปลอดภัยได้ทั้งหมด

#### ข้อมูลที่ต้องได้รับการยืนยันก่อนเผยแพร่

- ชื่อและที่อยู่ของผู้ควบคุมข้อมูล รวมถึงช่องทางติดต่อด้านความเป็นส่วนตัว
- ฐานกฎหมายของแต่ละวัตถุประสงค์ เขตอำนาจที่ใช้ และสิทธิของเจ้าของข้อมูล
- ตารางระยะเวลาเก็บรักษา การลบข้อมูล และขั้นตอนรับคำขอใช้สิทธิ
- รายชื่อ processor/subprocessor ประเทศที่จัดเก็บข้อมูล และกลไกการโอนข้อมูล
- วันมีผล เจ้าของนโยบาย การทบทวนทางกฎหมาย และวิธีแจ้งเมื่อเนื้อหาเปลี่ยน

กลับหน้าหลัก

### Owner/legal fields

- [ ] Legal identity and address of the data controller
- [ ] Privacy contact channel and responsible role
- [ ] Applicable jurisdiction and legal basis for each processing purpose
- [ ] Data-subject rights applicable to the service
- [ ] Identity-verification and response process for rights requests
- [ ] Response deadlines, escalation path and request audit trail
- [ ] Processor/subprocessor names, purposes and contractual status
- [ ] Database, object-storage, hosting and SMTP data locations
- [ ] International transfer mechanism, if applicable
- [ ] Approved effective date, policy owner and review cadence
- [ ] Change-notification procedure

### Retention and deletion decisions

For each data class in `PRIVACY_DATA_INVENTORY.md`, record:

- Retention period or event that starts retention
- Reason and legal basis
- Deletion/anonymization method
- Backup/log retention interaction
- Responsible owner
- Exception or legal-hold process

The current application does not provide a verified complete account export/deletion workflow. The final text must not claim otherwise.

### Privacy approval record

- Decision: `APPROVE EXACT CONTENT` / `REJECT` / `CHANGES REQUIRED`
- Approved version: ______________________________
- Effective date: ________________________________
- Controller/contact details approved: `YES` / `NO`
- Retention and rights process approved: `YES` / `NO`
- Processor/location inventory approved: `YES` / `NO`
- Approval source/reference: ______________________
- Approval date/time and timezone: ________________
- Approver identity/role: _________________________

This is a content approval record, not deployment authorization. Do not publish until all mandatory fields are complete and the Owner authorizes publication separately.

## 3. Supabase backup and recovery readiness

Status: **NOT VERIFIED**

- [ ] Correct Production Supabase project independently identified
- [ ] Database backup feature and plan capability confirmed
- [ ] Backup schedule recorded
- [ ] Latest successful backup timestamp is before release activity
- [ ] Backup retention period recorded
- [ ] PITR availability and recovery window recorded, or explicitly marked unavailable
- [ ] Restore procedure and required permissions documented
- [ ] Restore to an isolated project/database is feasible
- [ ] Isolated restore evidence or drill result recorded
- [ ] Database restore verification covers schema ledger, critical row counts and application health
- [ ] Storage buckets are handled separately from database backup
- [ ] Storage object inventory/manifest and recovery/export method documented
- [ ] Recovery owner named
- [ ] RPO approved: _______________________________
- [ ] RTO approved: _______________________________
- [ ] Verification date/time, verifier and evidence reference recorded

Do not assume PITR, retention or Storage recovery from database backup. Missing evidence blocks deployment approval.

## 4. Remaining shortest path

1. Name the Nodemailer remediation owner.
2. Complete SMTP/TLS verification without disclosing secrets.
3. Approve or revise the exact Privacy P2 content and fill mandatory legal/operational fields.
4. Provide Supabase backup, PITR and isolated-restore evidence plus Storage recovery plan.
5. Separately authorize the final local commit scope.
6. Separately authorize push and obtain fresh Standard CI and PostgreSQL 16 CI with zero PostgreSQL skips.
7. Review the exact final SHA and all external evidence before any deployment authorization.
