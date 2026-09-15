# CSIT Sheet Master Renovation Tickets

ทุก ticket ใช้ implementation เดิมเป็นฐาน และมีฟิลด์ Goal, Why, Scope, Reuse, Files, DB/API, Dependencies, Implementation, Acceptance, Tests และ Verification ตามแม่แบบด้านล่าง โดย Verification ต้องมาจากคำสั่งที่รันจริงหรือระบุ NOT RUN เท่านั้น

## TICKET-001 — Repository audit
**Goal/Why:** ล็อก architecture จริงและไม่สร้างระบบคู่ขนาน. **Scope/Reuse:** auth, upload, public reads, contribution, duplicate, storage เดิม. **Files:** `AUDIT.md`. **DB/API:** none. **Dependencies:** none. **Implementation:** trace source of truth/risk. **Acceptance/Tests/Verification:** audit ครบและมี baseline.

## TICKET-002 — UX/UI audit
**Goal/Why:** หา language/hierarchy/responsive/admin gaps. **Scope/Reuse:** Vue views/classes เดิม. **Files:** audit. **DB/API:** none. **Dependencies:** 001. **Implementation:** screen/state inventory. **Acceptance/Tests/Verification:** ครบ user/admin/overflow.

## TICKET-003 — Design reference
**Goal/Why:** แปลงแนวคิด Passionfroot อย่างปลอดภัย. **Scope/Reuse:** public main/gallery/help. **Files:** audit/spec. **DB/API:** none. **Dependencies:** 002. **Implementation:** dated source analysis. **Acceptance/Tests/Verification:** ระบุหลักการและ non-copy boundary.

## TICKET-004 — Design tokens/theme
**Goal/Why:** หนึ่ง visual language. **Scope/Reuse:** semantic color/type/space/radius/shadow/border/icon/control/layout/breakpoint/motion. **Files:** styles. **DB/API:** none. **Dependencies:** 003. **Implementation:** CSS variables. **Acceptance/Tests/Verification:** warm theme และ build/style checks.

## TICKET-005 — Thai typography
**Goal/Why:** ไม่ให้ภาษาไทย clip. **Scope/Reuse:** global type scale. **Files:** styles. **DB/API:** none. **Dependencies:** 004. **Implementation:** Thai stack/line-height. **Acceptance/Tests/Verification:** readable minimums.

## TICKET-006 — Shared UI primitives
**Goal/Why:** identity/status/dialog สม่ำเสมอ. **Scope/Reuse:** shared Vue patterns. **Files:** `UserIdentity`, `StatusBadge`, `ConfirmDialog`. **DB/API:** none. **Dependencies:** 004–005. **Implementation:** accessible primitives. **Acceptance/Tests/Verification:** keyboard/ARIA tests.

## TICKET-007 — App shell/navigation
**Goal/Why:** Thai navigation ทุกขนาด. **Scope/Reuse:** shell/routes/auth. **Files:** shell/views. **DB/API:** none. **Dependencies:** 006. **Implementation:** 5 links + Search + mobile menu. **Acceptance/Tests/Verification:** ไม่มี request nav แยก.

## TICKET-008 — Home redesign
**Goal/Why:** course discovery. **Scope/Reuse:** course counts/API. **Files:** home. **DB/API:** none. **Dependencies:** 007. **Implementation:** cards/states. **Acceptance/Tests/Verification:** counts dynamic และ approved-only.

## TICKET-009 — Course/year/semester
**Goal/Why:** hierarchy ชัด. **Scope/Reuse:** dynamic endpoints. **Files:** course panels. **DB/API:** none. **Dependencies:** 008. **Implementation:** breadcrumb/cards/groups. **Acceptance/Tests/Verification:** only real years/semesters.

## TICKET-010 — Lecture/Sheet catalogs
**Goal/Why:** typed discovery สม่ำเสมอ. **Scope/Reuse:** shared catalog. **Files:** catalog panels. **DB/API:** none. **Dependencies:** 009. **Implementation:** Thai type presentation. **Acceptance/Tests/Verification:** filters ไม่รั่วข้ามประเภท.

## TICKET-011 — Document card/detail
**Goal/Why:** impact/contributor อ่านง่าย. **Scope/Reuse:** unified document DTO/actions. **Files:** document components. **DB/API:** contributor display/avatar fields. **Dependencies:** 006. **Implementation:** safe summary/actions. **Acceptance/Tests/Verification:** long text และ View/Download/Helpful.

## TICKET-012 — Unified search
**Goal/Why:** ค้นเอกสารและคนจากจุดเดียว. **Scope/Reuse:** document search + contributor search. **Files:** search/services. **DB/API:** consume contributor endpoint. **Dependencies:** 011,015. **Implementation:** separate sections. **Acceptance/Tests/Verification:** Thai states and routing.

## TICKET-013 — Public contributor model/API
**Goal/Why:** identity สาธารณะโดยไม่รั่วข้อมูล. **Scope/Reuse:** aggregate/score rules. **Files:** DB/repo/controller/routes. **DB/API:** display name + endpoints. **Dependencies:** 001. **Implementation:** whitelist/set query. **Acceptance/Tests/Verification:** no email/private/BLOB/N+1.

## TICKET-014 — Public Profile
**Goal/Why:** สำรวจผลงานผู้แบ่งปัน. **Scope/Reuse:** approved documents/recognition. **Files:** router/panel/service. **DB/API:** profile endpoint. **Dependencies:** 013. **Implementation:** `/dashboard/users/:username`. **Acceptance/Tests/Verification:** safe metrics/badges/docs.

## TICKET-015 — User Search
**Goal/Why:** ค้นด้วย username/display name. **Scope/Reuse:** auth and public contributor model. **Files:** repo/controller/card. **DB/API:** search/index. **Dependencies:** 013. **Implementation:** partial case-insensitive limit. **Acceptance/Tests/Verification:** privacy negatives.

## TICKET-016 — Upload redesign
**Goal/Why:** ส่งเอกสารอย่างมั่นใจ. **Scope/Reuse:** validation/dropzone/form. **Files:** upload form/panel. **DB/API:** none. **Dependencies:** 004–007. **Implementation:** Thai grouping/states. **Acceptance/Tests/Verification:** file/type/size/loading/error/success.

## TICKET-017 — My Uploads redesign
**Goal/Why:** เข้าใจ lifecycle ในแท็บ Upload. **Scope/Reuse:** filters/status/reasons. **Files:** requests/upload panel. **DB/API:** none. **Dependencies:** 006,016. **Implementation:** readable cards. **Acceptance/Tests/Verification:** duplicate/rejection reasons ไม่หาย.

## TICKET-018 — Own Profile redesign
**Goal/Why:** identity + impact. **Scope/Reuse:** current profile API. **Files:** profile. **DB/API:** auth display name. **Dependencies:** 013. **Implementation:** public link/metrics. **Acceptance/Tests/Verification:** email เฉพาะเจ้าของ.

## TICKET-019 — Contribution analytics
**Goal/Why:** ให้คุณค่ากับ impact. **Scope/Reuse:** authoritative aggregates. **Files:** own/public profiles. **DB/API:** safe subset. **Dependencies:** 013,018. **Implementation:** metric composition. **Acceptance/Tests/Verification:** reconcile with public data.

## TICKET-020 — Helpful
**Goal/Why:** community signal. **Scope/Reuse:** idempotent endpoint. **Files:** action UI/tests. **DB/API:** unchanged. **Dependencies:** 011. **Implementation:** pressed state/Thai feedback. **Acceptance/Tests/Verification:** toggle/repeat/self rules.

## TICKET-021 — Score/anti-abuse
**Goal/Why:** server-authoritative reputation. **Scope/Reuse:** scoring constants/unique interactions. **Files:** tests/docs. **DB/API:** unchanged. **Dependencies:** 019–020. **Implementation:** regression assertions. **Acceptance/Tests/Verification:** retry/self/duplicate ไม่ inflate.

## TICKET-022 — Levels/badges
**Goal/Why:** recognition ที่อธิบายได้. **Scope/Reuse:** derived recognition. **Files:** profile/identity UI. **DB/API:** safe derived fields. **Dependencies:** 021. **Implementation:** render deterministic values. **Acceptance/Tests/Verification:** threshold fixtures.

## TICKET-023 — Duplicate consolidation
**Goal/Why:** classifier เดียว. **Scope/Reuse:** current matching pipeline. **Files:** tests/admin UI. **DB/API:** unchanged. **Dependencies:** existing. **Implementation:** surface precedence. **Acceptance/Tests/Verification:** exact/content/possible/none.

## TICKET-024 — SHA-256
**Goal/Why:** exact identity ไม่พึ่งชื่อไฟล์. **Scope/Reuse:** server hash/backfill. **Files:** tests. **DB/API:** unchanged. **Dependencies:** 023. **Implementation:** renamed-binary fixture. **Acceptance/Tests/Verification:** EXACT_DUPLICATE.

## TICKET-025 — Content fingerprint
**Goal/Why:** semantic duplicate ที่รองรับ. **Scope/Reuse:** bounded text/simple PDF extraction. **Files:** service/tests. **DB/API:** unchanged. **Dependencies:** 023. **Implementation:** normalize/hash/fallback. **Acceptance/Tests/Verification:** CONTENT or safe fallback.

## TICKET-026 — Storage dedup
**Goal/Why:** binary เดียวต่อ SHA. **Scope/Reuse:** FileAsset/cleanup/trigger. **Files:** storage tests/report. **DB/API:** unchanged. **Dependencies:** 024. **Implementation:** shared references. **Acceptance/Tests/Verification:** orphan-only cleanup.

## TICKET-027 — Admin shell/dashboard
**Goal/Why:** เริ่มด้วยสิ่งที่ต้องทำ. **Scope/Reuse:** stats/shell. **Files:** admin view/dashboard/router. **DB/API:** unchanged. **Dependencies:** 007. **Implementation:** default action-needed page. **Acceptance/Tests/Verification:** pending CTA/Thai metrics.

## TICKET-028 — Admin review queue
**Goal/Why:** ลด cognitive load. **Scope/Reuse:** request DTO. **Files:** admin request. **DB/API:** unchanged. **Dependencies:** 027. **Implementation:** summary + one review action. **Acceptance/Tests/Verification:** queue/status readable.

## TICKET-029 — Approval workspace
**Goal/Why:** preview/metadata/decision ในบริบทเดียว. **Scope/Reuse:** existing file/action APIs. **Files:** admin request/dialog. **DB/API:** unchanged. **Dependencies:** 028. **Implementation:** split/stack/sticky/actions/object cleanup. **Acceptance/Tests/Verification:** next item after decision.

## TICKET-030 — Duplicate comparison
**Goal/Why:** ตัดสินเอกสารซ้ำอย่างปลอดภัย. **Scope/Reuse:** match DTO/files. **Files:** workspace. **DB/API:** unchanged. **Dependencies:** 029. **Implementation:** New vs Existing + signals. **Acceptance/Tests/Verification:** confirmation and existing file action.

## TICKET-031 — Long text/responsive
**Goal/Why:** ไม่มี overlap. **Scope:** 375/768/1024/1440 + pathological strings. **Files:** styles/components/tests. **DB/API:** none. **Dependencies:** UI tickets. **Implementation:** min-width/wrap/clamp/grid. **Acceptance/Tests/Verification:** actions reachable.

## TICKET-032 — Thai-first copy
**Goal/Why:** ภาษาสอดคล้องกัน. **Scope:** user/admin/states. **Files:** terminology/components. **DB/API:** enums unchanged. **Dependencies:** UI tickets. **Implementation:** presentation maps/copy pass. **Acceptance/Tests/Verification:** majority Thai.

## TICKET-033 — Animation
**Goal/Why:** feedback ที่นุ่มและเร็ว. **Scope:** hover/press/dialog/tabs/skeleton. **Files:** styles. **DB/API:** none. **Dependencies:** 004. **Implementation:** tokenized transitions. **Acceptance/Tests/Verification:** reduced-motion override.

## TICKET-034 — Accessibility
**Goal/Why:** keyboard/screen reader/contrast. **Scope:** shell/forms/dialog/status/actions. **Files:** components/styles/tests. **DB/API:** none. **Dependencies:** 006–033. **Implementation:** semantics/focus/ARIA/touch targets. **Acceptance/Tests/Verification:** component assertions.

## TICKET-035 — Migration/backfill
**Goal/Why:** display identity โดยไม่เสียข้อมูล. **Scope:** idempotent column/backfill/index. **Files:** database/tests. **DB/API:** `users.display_name`. **Dependencies:** 013. **Implementation:** additive SQL. **Acceptance/Tests/Verification:** migrate twice/FK check.

## TICKET-036 — Security/privacy
**Goal/Why:** ป้องกัน public/private crossover. **Scope:** DTO whitelist/auth/role/ownership/query limit. **Files:** contributor/controllers/tests. **DB/API:** safe contracts. **Dependencies:** 013–015. **Implementation:** negative paths. **Acceptance/Tests/Verification:** anonymous/private-field checks.

## TICKET-037 — Backend tests
**Goal/Why:** verify data contracts/regression. **Scope:** migration/contributor/search/3 actors/existing suites. **Files:** backend tests. **DB/API:** isolated fixture DB. **Dependencies:** backend tickets. **Implementation:** integration assertions. **Acceptance/Tests/Verification:** actual suite pass.

## TICKET-038 — Frontend tests
**Goal/Why:** verify critical UX. **Scope:** terminology/contributor/search/profile/admin/dialog/responsive semantics. **Files:** frontend tests. **DB/API:** mocks. **Dependencies:** UI tickets. **Implementation:** component/source tests. **Acceptance/Tests/Verification:** actual suite pass.

## TICKET-039 — 3-actor E2E
**Goal/Why:** พิสูจน์ community loop. **Scope:** user1/admin1/user2 approval/discovery/profile/search/Helpful/download/duplicate/retry. **Files:** integration tests. **DB/API:** isolated DB. **Dependencies:** 037. **Implementation:** deterministic fixture. **Acceptance/Tests/Verification:** one publication/reward + privacy/idempotency/dedup.

## TICKET-040 — Visual QA
**Goal/Why:** ตรวจ rendered product. **Scope:** user/admin routes, widths, long strings, motion. **Files:** review report. **DB/API:** none. **Dependencies:** UI done. **Implementation:** real browser only. **Acceptance/Tests/Verification:** screenshots/inspection or honest NOT RUN.

## TICKET-041 — Production build
**Goal/Why:** prove artifact/startup. **Scope:** migration/lint/tests/build/health/static smoke. **Files:** generated artifacts only. **DB/API:** temp production DB. **Dependencies:** 037–040. **Implementation:** supported commands. **Acceptance/Tests/Verification:** actual results.

## TICKET-042 — Final regression/code review
**Goal/Why:** ปิด acceptance อย่างตรงไปตรงมา. **Scope:** architecture/security/UI/data/deploy. **Files:** `CODE_REVIEW_TH.md`. **DB/API:** none. **Dependencies:** all. **Implementation:** 19 Thai sections. **Acceptance/Tests/Verification:** commands จริง, remaining issues จริง, deploy status หนึ่งค่า.
