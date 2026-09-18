# CSIT Sheet Master Renovation Tickets

สถานะอัปเดต 2026-09-15: ticket 001–042 เก็บประวัติการปรับระบบรอบเดิมไว้ ส่วน 043–050 เป็นงานต่อยอดตาม master prompt ปัจจุบัน รายละเอียดสเปกที่ใช้งานจริงอยู่ใน SPEC.md ผลคำสั่งและขอบเขต QA อยู่ใน CODE_REVIEW_TH.md ทุกรายการใช้ระบบเดิมและไม่มีผลต่อ runtime จากไฟล์ tickets

ทุก ticket ใช้ implementation เดิมเป็นฐาน และมีฟิลด์ Goal, Why, Scope, Reuse, Files, DB/API, Dependencies, Implementation, Acceptance, Tests และ Verification ตามแม่แบบด้านล่าง โดย Verification ต้องมาจากคำสั่งที่รันจริงหรือระบุ NOT RUN เท่านั้น

## TICKET-001 — Repository audit
**Status:** DONE
**Goal/Why:** ล็อก architecture จริงและไม่สร้างระบบคู่ขนาน. **Scope/Reuse:** auth, upload, public reads, contribution, duplicate, storage เดิม. **Files:** `AUDIT.md`. **DB/API:** none. **Dependencies:** none. **Implementation:** trace source of truth/risk. **Acceptance/Tests/Verification:** audit ครบและมี baseline.

## TICKET-002 — UX/UI audit
**Status:** DONE
**Goal/Why:** หา language/hierarchy/responsive/admin gaps. **Scope/Reuse:** Vue views/classes เดิม. **Files:** audit. **DB/API:** none. **Dependencies:** 001. **Implementation:** screen/state inventory. **Acceptance/Tests/Verification:** ครบ user/admin/overflow.

## TICKET-003 — Design reference
**Status:** DONE
**Goal/Why:** แปลงแนวคิด Passionfroot อย่างปลอดภัย. **Scope/Reuse:** public main/gallery/help. **Files:** audit/spec. **DB/API:** none. **Dependencies:** 002. **Implementation:** dated source analysis. **Acceptance/Tests/Verification:** ระบุหลักการและ non-copy boundary.

## TICKET-004 — Design tokens/theme
**Status:** DONE
**Goal/Why:** หนึ่ง visual language. **Scope/Reuse:** semantic color/type/space/radius/shadow/border/icon/control/layout/breakpoint/motion. **Files:** styles. **DB/API:** none. **Dependencies:** 003. **Implementation:** CSS variables. **Acceptance/Tests/Verification:** warm theme และ build/style checks.

## TICKET-005 — Thai typography
**Status:** DONE
**Goal/Why:** ไม่ให้ภาษาไทย clip. **Scope/Reuse:** global type scale. **Files:** styles. **DB/API:** none. **Dependencies:** 004. **Implementation:** Thai stack/line-height. **Acceptance/Tests/Verification:** readable minimums.

## TICKET-006 — Shared UI primitives
**Status:** DONE
**Goal/Why:** identity/status/dialog สม่ำเสมอ. **Scope/Reuse:** shared Vue patterns. **Files:** `UserIdentity`, `StatusBadge`, `ConfirmDialog`. **DB/API:** none. **Dependencies:** 004–005. **Implementation:** accessible primitives. **Acceptance/Tests/Verification:** keyboard/ARIA tests.

## TICKET-007 — App shell/navigation
**Status:** DONE
**Goal/Why:** Thai navigation ทุกขนาด. **Scope/Reuse:** shell/routes/auth. **Files:** shell/views. **DB/API:** none. **Dependencies:** 006. **Implementation:** 5 links + Search + mobile menu. **Acceptance/Tests/Verification:** ไม่มี request nav แยก.

## TICKET-008 — Home redesign
**Status:** DONE
**Goal/Why:** course discovery. **Scope/Reuse:** course counts/API. **Files:** home. **DB/API:** none. **Dependencies:** 007. **Implementation:** cards/states. **Acceptance/Tests/Verification:** counts dynamic และ approved-only.

## TICKET-009 — Course/year/semester
**Status:** DONE
**Goal/Why:** hierarchy ชัด. **Scope/Reuse:** dynamic endpoints. **Files:** course panels. **DB/API:** none. **Dependencies:** 008. **Implementation:** breadcrumb/cards/groups. **Acceptance/Tests/Verification:** only real years/semesters.

## TICKET-010 — Lecture/Sheet catalogs
**Status:** DONE
**Goal/Why:** typed discovery สม่ำเสมอ. **Scope/Reuse:** shared catalog. **Files:** catalog panels. **DB/API:** none. **Dependencies:** 009. **Implementation:** Thai type presentation. **Acceptance/Tests/Verification:** filters ไม่รั่วข้ามประเภท.

## TICKET-011 — Document card/detail
**Status:** DONE
**Goal/Why:** impact/contributor อ่านง่าย. **Scope/Reuse:** unified document DTO/actions. **Files:** document components. **DB/API:** contributor display/avatar fields. **Dependencies:** 006. **Implementation:** safe summary/actions. **Acceptance/Tests/Verification:** long text และ View/Download/Helpful.

## TICKET-012 — Unified search
**Status:** DONE
**Goal/Why:** ค้นเอกสารและคนจากจุดเดียว. **Scope/Reuse:** document search + contributor search. **Files:** search/services. **DB/API:** consume contributor endpoint. **Dependencies:** 011,015. **Implementation:** separate sections. **Acceptance/Tests/Verification:** Thai states and routing.

## TICKET-013 — Public contributor model/API
**Status:** DONE
**Goal/Why:** identity สาธารณะโดยไม่รั่วข้อมูล. **Scope/Reuse:** aggregate/score rules. **Files:** DB/repo/controller/routes. **DB/API:** display name + endpoints. **Dependencies:** 001. **Implementation:** whitelist/set query. **Acceptance/Tests/Verification:** no email/private/BLOB/N+1.

## TICKET-014 — Public Profile
**Status:** DONE
**Goal/Why:** สำรวจผลงานผู้แบ่งปัน. **Scope/Reuse:** approved documents/recognition. **Files:** router/panel/service. **DB/API:** profile endpoint. **Dependencies:** 013. **Implementation:** `/dashboard/users/:username`. **Acceptance/Tests/Verification:** safe metrics/badges/docs.

## TICKET-015 — User Search
**Status:** DONE
**Goal/Why:** ค้นด้วย username/display name. **Scope/Reuse:** auth and public contributor model. **Files:** repo/controller/card. **DB/API:** search/index. **Dependencies:** 013. **Implementation:** partial case-insensitive limit. **Acceptance/Tests/Verification:** privacy negatives.

## TICKET-016 — Upload redesign
**Status:** DONE
**Goal/Why:** ส่งเอกสารอย่างมั่นใจ. **Scope/Reuse:** validation/dropzone/form. **Files:** upload form/panel. **DB/API:** none. **Dependencies:** 004–007. **Implementation:** Thai grouping/states. **Acceptance/Tests/Verification:** file/type/size/loading/error/success.

## TICKET-017 — My Uploads redesign
**Status:** DONE
**Goal/Why:** เข้าใจ lifecycle ในแท็บ Upload. **Scope/Reuse:** filters/status/reasons. **Files:** requests/upload panel. **DB/API:** none. **Dependencies:** 006,016. **Implementation:** readable cards. **Acceptance/Tests/Verification:** duplicate/rejection reasons ไม่หาย.

## TICKET-018 — Own Profile redesign
**Status:** DONE
**Goal/Why:** identity + impact. **Scope/Reuse:** current profile API. **Files:** profile. **DB/API:** auth display name. **Dependencies:** 013. **Implementation:** public link/metrics. **Acceptance/Tests/Verification:** email เฉพาะเจ้าของ.

## TICKET-019 — Contribution analytics
**Status:** DONE
**Goal/Why:** ให้คุณค่ากับ impact. **Scope/Reuse:** authoritative aggregates. **Files:** own/public profiles. **DB/API:** safe subset. **Dependencies:** 013,018. **Implementation:** metric composition. **Acceptance/Tests/Verification:** reconcile with public data.

## TICKET-020 — Helpful
**Status:** DONE
**Goal/Why:** community signal. **Scope/Reuse:** idempotent endpoint. **Files:** action UI/tests. **DB/API:** unchanged. **Dependencies:** 011. **Implementation:** pressed state/Thai feedback. **Acceptance/Tests/Verification:** toggle/repeat/self rules.

## TICKET-021 — Score/anti-abuse
**Status:** DONE
**Goal/Why:** server-authoritative reputation. **Scope/Reuse:** scoring constants/unique interactions. **Files:** tests/docs. **DB/API:** unchanged. **Dependencies:** 019–020. **Implementation:** regression assertions. **Acceptance/Tests/Verification:** retry/self/duplicate ไม่ inflate.

## TICKET-022 — Levels/badges
**Status:** DONE
**Goal/Why:** recognition ที่อธิบายได้. **Scope/Reuse:** derived recognition. **Files:** profile/identity UI. **DB/API:** safe derived fields. **Dependencies:** 021. **Implementation:** render deterministic values. **Acceptance/Tests/Verification:** threshold fixtures.

## TICKET-023 — Duplicate consolidation
**Status:** DONE
**Goal/Why:** classifier เดียว. **Scope/Reuse:** current matching pipeline. **Files:** tests/admin UI. **DB/API:** unchanged. **Dependencies:** existing. **Implementation:** surface precedence. **Acceptance/Tests/Verification:** exact/content/possible/none.

## TICKET-024 — SHA-256
**Status:** DONE
**Goal/Why:** exact identity ไม่พึ่งชื่อไฟล์. **Scope/Reuse:** server hash/backfill. **Files:** tests. **DB/API:** unchanged. **Dependencies:** 023. **Implementation:** renamed-binary fixture. **Acceptance/Tests/Verification:** EXACT_DUPLICATE.

## TICKET-025 — Content fingerprint
**Status:** DONE
**Goal/Why:** semantic duplicate ที่รองรับ. **Scope/Reuse:** bounded text/simple PDF extraction. **Files:** service/tests. **DB/API:** unchanged. **Dependencies:** 023. **Implementation:** normalize/hash/fallback. **Acceptance/Tests/Verification:** CONTENT or safe fallback.

## TICKET-026 — Storage dedup
**Status:** DONE
**Goal/Why:** binary เดียวต่อ SHA. **Scope/Reuse:** FileAsset/cleanup/trigger. **Files:** storage tests/report. **DB/API:** unchanged. **Dependencies:** 024. **Implementation:** shared references. **Acceptance/Tests/Verification:** orphan-only cleanup.

## TICKET-027 — Admin shell/dashboard
**Status:** DONE
**Goal/Why:** เริ่มด้วยสิ่งที่ต้องทำ. **Scope/Reuse:** stats/shell. **Files:** admin view/dashboard/router. **DB/API:** unchanged. **Dependencies:** 007. **Implementation:** default action-needed page. **Acceptance/Tests/Verification:** pending CTA/Thai metrics.

## TICKET-028 — Admin review queue
**Status:** DONE
**Goal/Why:** ลด cognitive load. **Scope/Reuse:** request DTO. **Files:** admin request. **DB/API:** unchanged. **Dependencies:** 027. **Implementation:** summary + one review action. **Acceptance/Tests/Verification:** queue/status readable.

## TICKET-029 — Approval workspace
**Status:** DONE
**Goal/Why:** preview/metadata/decision ในบริบทเดียว. **Scope/Reuse:** existing file/action APIs. **Files:** admin request/dialog. **DB/API:** unchanged. **Dependencies:** 028. **Implementation:** split/stack/sticky/actions/object cleanup. **Acceptance/Tests/Verification:** next item after decision.

## TICKET-030 — Duplicate comparison
**Status:** DONE
**Goal/Why:** ตัดสินเอกสารซ้ำอย่างปลอดภัย. **Scope/Reuse:** match DTO/files. **Files:** workspace. **DB/API:** unchanged. **Dependencies:** 029. **Implementation:** New vs Existing + signals. **Acceptance/Tests/Verification:** confirmation and existing file action.

## TICKET-031 — Long text/responsive
**Status:** DONE
**Goal/Why:** ไม่มี overlap. **Scope:** 375/768/1024/1440 + pathological strings. **Files:** styles/components/tests. **DB/API:** none. **Dependencies:** UI tickets. **Implementation:** min-width/wrap/clamp/grid. **Acceptance/Tests/Verification:** actions reachable.

## TICKET-032 — Thai-first copy
**Status:** DONE
**Goal/Why:** ภาษาสอดคล้องกัน. **Scope:** user/admin/states. **Files:** terminology/components. **DB/API:** enums unchanged. **Dependencies:** UI tickets. **Implementation:** presentation maps/copy pass. **Acceptance/Tests/Verification:** majority Thai.

## TICKET-033 — Animation
**Status:** DONE
**Goal/Why:** feedback ที่นุ่มและเร็ว. **Scope:** hover/press/dialog/tabs/skeleton. **Files:** styles. **DB/API:** none. **Dependencies:** 004. **Implementation:** tokenized transitions. **Acceptance/Tests/Verification:** reduced-motion override.

## TICKET-034 — Accessibility
**Status:** DONE
**Goal/Why:** keyboard/screen reader/contrast. **Scope:** shell/forms/dialog/status/actions. **Files:** components/styles/tests. **DB/API:** none. **Dependencies:** 006–033. **Implementation:** semantics/focus/ARIA/touch targets. **Acceptance/Tests/Verification:** component assertions.

## TICKET-035 — Migration/backfill
**Status:** DONE
**Goal/Why:** display identity โดยไม่เสียข้อมูล. **Scope:** idempotent column/backfill/index. **Files:** database/tests. **DB/API:** `users.display_name`. **Dependencies:** 013. **Implementation:** additive SQL. **Acceptance/Tests/Verification:** migrate twice/FK check.

## TICKET-036 — Security/privacy
**Status:** DONE
**Goal/Why:** ป้องกัน public/private crossover. **Scope:** DTO whitelist/auth/role/ownership/query limit. **Files:** contributor/controllers/tests. **DB/API:** safe contracts. **Dependencies:** 013–015. **Implementation:** negative paths. **Acceptance/Tests/Verification:** anonymous/private-field checks.

## TICKET-037 — Backend tests
**Status:** DONE
**Goal/Why:** verify data contracts/regression. **Scope:** migration/contributor/search/3 actors/existing suites. **Files:** backend tests. **DB/API:** isolated fixture DB. **Dependencies:** backend tickets. **Implementation:** integration assertions. **Acceptance/Tests/Verification:** actual suite pass.

## TICKET-038 — Frontend tests
**Status:** DONE
**Goal/Why:** verify critical UX. **Scope:** terminology/contributor/search/profile/admin/dialog/responsive semantics. **Files:** frontend tests. **DB/API:** mocks. **Dependencies:** UI tickets. **Implementation:** component/source tests. **Acceptance/Tests/Verification:** actual suite pass.

## TICKET-039 — 3-actor E2E
**Status:** DONE
**Goal/Why:** พิสูจน์ community loop. **Scope:** user1/admin1/user2 approval/discovery/profile/search/Helpful/download/duplicate/retry. **Files:** integration tests. **DB/API:** isolated DB. **Dependencies:** 037. **Implementation:** deterministic fixture. **Acceptance/Tests/Verification:** one publication/reward + privacy/idempotency/dedup.

## TICKET-040 — Visual QA
**Status:** DONE
**Goal/Why:** ตรวจ rendered product. **Scope:** user/admin routes, widths, long strings, motion. **Files:** review report. **DB/API:** none. **Dependencies:** UI done. **Implementation:** real browser only. **Acceptance/Tests/Verification:** screenshots/inspection or honest NOT RUN.

## TICKET-041 — Production build
**Status:** DONE
**Goal/Why:** prove artifact/startup. **Scope:** migration/lint/tests/build/health/static smoke. **Files:** generated artifacts only. **DB/API:** temp production DB. **Dependencies:** 037–040. **Implementation:** supported commands. **Acceptance/Tests/Verification:** actual results.

## TICKET-042 — Final regression/code review
**Status:** DONE
**Goal/Why:** ปิด acceptance อย่างตรงไปตรงมา. **Scope:** architecture/security/UI/data/deploy. **Files:** `CODE_REVIEW_TH.md`. **DB/API:** none. **Dependencies:** all. **Implementation:** 22 Thai sections. **Acceptance/Tests/Verification:** commands จริง, remaining issues จริง, deploy status หนึ่งค่า.

## TICKET-043 — Starter Kit design system

**Status:** DONE

| Field | Detail |
|---|---|
| Goal / Reason | ใช้ neutral/black/purple แทน cream/lime ของรอบก่อน ให้ Starter/User/Admin เป็นผลิตภัณฑ์เดียวกัน |
| Scope / Reuse | semantic CSS tokens และ class contracts เดิม รวม auth/shell/cards/forms/dialog |
| Files | frontend/src/styles.css, frontend/index.html |
| DB / API impact | ไม่มี |
| Frontend impact | ปุ่มดำ พื้นกลาง ม่วงจำกัด สี semantic มีข้อความ ภาษาเอกสาร th และ line-height ไทย |
| Dependencies | 004–007, SPEC.md |
| Steps | เปลี่ยน tokens, แก้ contrast บน dark hero, neutralize cards, เพิ่ม monospace เฉพาะ labels และ focus/dropzone |
| Acceptance | ไม่มี Tailwind CDN/dependency ใหม่ ไม่เปลี่ยน enums ไทยไม่ clip long text ไม่ล้น |
| Tests | design-system source assertions และ browser matrix |
| Verification | lint/build และ 375/768/1024/1440 ผ่าน; ภาพจริงอยู่ artifacts/visual-qa |

## TICKET-044 — Existing Starter renovation and motion

**Status:** DONE

| Field | Detail |
|---|---|
| Goal / Reason | อธิบาย academic sharing ด้วย editorial hero/product preview/Bento/light-dark storytelling |
| Scope / Reuse | LandingView, AppNavbar, RouterLinks และ auth store เดิม |
| Files | LandingView.vue, AppNavbar.vue, styles.css, starter-page.test.js |
| DB / API impact | ไม่มี anonymous endpoint หรือสถิติปลอม |
| Frontend impact | hero, labelled concept demo, topic marquee, Bento, dark impact, community steps, CTA/footer |
| Dependencies | 043 |
| Steps | ออกแบบใน Vue, auth-aware CTAs, CSS autonomous motion, viewport observer/disconnect, pause/reduced-motion/static fallback |
| Acceptance | ไม่ใช้ HTML replacement; ไม่มี fake production files/users/metrics; input จริงไม่ถูก animation แก้ค่า |
| Tests | anonymous/USER/ADMIN destination, pause toggle, observer cleanup, browser pause/reduced motion |
| Verification | unit tests และ visual matrix ผ่าน; Starter เลิก import PNG เดิม 2.1MB |

## TICKET-045 — Contributor aggregate and queue performance

**Status:** DONE

| Field | Detail |
|---|---|
| Goal / Reason | ลด interaction × Helpful row multiplication และไม่โหลด BLOB ในคิว metadata |
| Scope / Reuse | contributor/read-model และ upload request DTO เดิม |
| Files | contributor.repository.js, uploadRequest.repository.js, contributor-aggregates.test.js |
| DB impact | ไม่มี migration; ใช้ uniqueness/index เดิม |
| API impact | response compatibility คงเดิม; legacy self rows ไม่เป็น reward |
| Frontend impact | metrics สอดคล้องเดิมและคิวใช้ metadata เท่านั้น |
| Dependencies | 013,019–021 |
| Steps | แยก grouped downloads/votes CTE, owner exclusion, explicit projection, reconcile fixture totals |
| Acceptance | 2 publications + 4 qualified downloads + 6 Helpful = 78 points; search/profile ตรงกัน; owner rows ไม่เพิ่ม score |
| Tests | aggregate fixture และ existing 3-actor HTTP suite |
| Verification | Backend 30/30 ผ่าน |

## TICKET-046 — Admin preview and decision safety

**Status:** DONE

| Field | Detail |
|---|---|
| Goal / Reason | ป้องกัน preview ผิดรายการเมื่อ response ไม่เรียงลำดับ และยืนยัน publication ก่อนตัดสินใจ |
| Scope / Reuse | queue/workspace/ConfirmDialog/Admin APIs/object URLs เดิม |
| Files | AdminRequestPanel.vue, admin-review-safety.test.js |
| DB / API impact | ไม่เพิ่ม endpoint; pending evidence ใช้ admin request-file endpoint |
| Frontend impact | discard stale response, decision ID, busy guard, approval dialog, success status, pending file actions |
| Dependencies | 028–030,043 |
| Steps | generation/disposal guard, revoke URLs, confirmation for all modes, bind ID, reload next item, mobile action wrapping |
| Acceptance | ไฟล์และ metadata ตรงกัน; click ซ้ำไม่ส่งซ้ำ; cancel ไม่ publish; pending comparator เปิดได้เฉพาะ Admin |
| Tests | slow A/fast B, confirm/cancel/publication, pending match endpoint, browser keyboard focus |
| Verification | Frontend safety tests และ visual dialog/preview ที่ทุก width ผ่าน |

## TICKET-047 — CSP preview compatibility

**Status:** DONE

| Field | Detail |
|---|---|
| Goal / Reason | แก้ production CSP บล็อก Blob iframe ทำให้โหลดสำเร็จแต่ preview ว่าง |
| Scope / Reuse | Helmet และ authenticated file-serving เดิม |
| Files | backend/src/app.js, material-publishing.test.js, visual-qa.mjs |
| DB impact | ไม่มี |
| API impact | CSP เพิ่ม frame-src 'self' blob: เท่านั้น |
| Frontend impact | document preview ใช้งานได้ภายใต้ production headers |
| Dependencies | 046 |
| Steps | เพิ่ม frame sources, assert self-only scripts, ตรวจ iframe content และ browser security logs บน HTTPS |
| Acceptance | preview แสดง bytes จริง; ไม่อนุญาต arbitrary external frame หรือ inline script |
| Tests | health CSP assertions และ real-browser iframe/security checks |
| Verification | CSP/preview checks ผ่าน ไม่มี security-policy error ในรอบสุดท้าย |

## TICKET-048 — SPA routes and keyboard accessibility

**Status:** DONE

| Field | Detail |
|---|---|
| Goal / Reason | shared Lecture/Sheet component ไม่ค้างข้อมูลเก่า และ upload tabs ใช้ keyboard ได้ |
| Scope / Reuse | nested RouterView, public profile load, Search, Upload, mobile shell เดิม |
| Files | UserDashboardView.vue, PublicProfilePanel.vue, DocumentSearchPanel.vue, UserUploadPanel.vue, DashboardShell.vue, navigation/catalog/upload tests |
| DB / API impact | ไม่มี; contributor @prefix ถูกนำออกก่อนส่ง query |
| Frontend impact | route-key remount, stale profile guard, tab/panel relation, roving tabindex, Arrow/Home/End, Escape menu |
| Dependencies | 007,010,012,014,016 |
| Steps | key view by fullPath, guard generation, decorate username query, keyboard tabs/ARIA IDs, navigation regressions |
| Acceptance | เปลี่ยน Lecture → Sheet โหลด typed data ใหม่; query เก่าไม่รั่ว; focus/panels สัมพันธ์ถูกต้อง |
| Tests | actual memory-router navigation และ keyboard tab focus |
| Verification | Frontend 19/19 ผ่าน |

## TICKET-049 — Isolated real-browser QA and 3 actors

**Status:** DONE

| Field | Detail |
|---|---|
| Goal / Reason | พิสูจน์ rendered UI และ community loop จริง ห้ามสรุป visual PASS จาก build อย่างเดียว |
| Scope / Reuse | production build, actual Express app/migrations, installed Edge, Node built-ins |
| Files | scripts/visual-qa.mjs, package.json, .gitignore, README.md, local QA artifacts |
| DB impact | fresh temporary DB; ไม่แตะ/seed ฐานข้อมูลจริง |
| API impact | ไม่มี; HTTPS fixture ตั้ง allowed origin และ production security เดิม |
| Frontend impact | ไม่มี runtime test hooks |
| Dependencies | 043–048 |
| Steps | migration twice, isolated actors/profile/certificate, capture four widths, bounds/CSP/preview/pause/reduced-motion/keyboard, browser upload → approve → discover → profile → Helpful/download |
| Acceptance | 375/768/1024/1440 ไม่ overflow; one public record/reward; pending privacy; repeat download ไม่ inflate |
| Tests | npm run test:visual และ screenshot inspection |
| Verification | PASS: 89 screenshots / 85 checks, 4 widths, CSP/preview/pause/focus และ browser 3-actor lifecycle ครบ; pending private, one publication, Helpful +5, repeated downloads รวม +2 |

## TICKET-050 — Final verification and Thai code review

**Status:** DONE

| Field | Detail |
|---|---|
| Goal / Reason | ส่งงานพร้อมหลักฐานและสถานะ deploy ตามจริง |
| Scope / Reuse | supported npm commands/tests, SPEC/AUDIT/ticket history |
| Files | SPEC.md, AUDIT.md, TICKETS.md, CODE_REVIEW_TH.md, README.md |
| DB / API / Frontend impact | documentation เท่านั้น |
| Dependencies | 049 |
| Steps | ตรวจ final suites/lint/build/audit/migration/startup, สรุป 22 Thai sections, ระบุข้อจำกัดและ settings จริง |
| Acceptance | ไม่ fabricate PASS; deploy status หนึ่งค่า; pending tasks ระบุชัดเจน |
| Tests | Backend/Frontend/Visual suites และ production smoke |
| Verification | suites 30/19, lint/build, production audit 0 vulnerabilities, migration twice/FK/integrity, browser lifecycle และ production startup/HTTP smoke ผ่าน; Code Review ภาษาไทย 22 sections |


## TICKET-051 - Document-focused Profile

| Field | Detail |
| --- | --- |
| Status | DONE |
| Scope | Profile layout/sidebar, routed Overview/Documents/Upload Requests/Stars, real contribution calendar, public document filters, account Stars and display-name editing; retain existing theme |
| Data | Reuse users, approved Sheet/Lecture read model and owner upload requests; add only the missing document_stars relationship with account/type/document uniqueness |
| Privacy | Other profiles exclude private requests, upload activity and account metadata; saved interests join approved documents |
| Verification | Backend 31/31, frontend 21/21, lint/build PASS; isolated Edge QA 109 screenshots/109 checks at four widths, reload persistence, Unstar, private requests, migration twice and publishing lifecycle PASS |
| Review | PROFILE_REVIEW.md |


## TICKET-052 - Course, Teacher, and Course Offering upload metadata

| Field | Detail |
| --- | --- |
| Status | DONE |
| Scope | NU IT curriculum seed, bilingual Course metadata, Teacher management, team-taught Course Offerings, moderated Teacher Suggestions, dependent Upload fields, document metadata |
| Security | USER/ADMIN role enforcement; optional teacher validated against exact Course/BE year/semester; suggestion approval transaction; duplicate constraints |
| Compatibility | Existing courses/documents and denormalized teacher names remain valid; new references are nullable |
| Verification | Backend 36/36 and frontend 23/23; repeat seed 54 Courses, 0 Teachers/Offerings, FK clean; lint/build; Edge responsive/production lifecycle PASS |
| External data | Course seed verified against NU IT curriculum 2565; no teacher or timetable data invented |
