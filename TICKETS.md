# Ordered Implementation Tickets

## NAV-001 — Audit and data-flow contract
- Goal: document current navigation, query, upload, and profile behavior.
- Scope: audit/spec/tickets.
- Files/modules affected: `AUDIT.md`, `SPEC.md`, `TICKETS.md`.
- Dependencies: none.
- Acceptance criteria: implementation plan reuses the unified read model and request lifecycle.
- Tests: source trace.
- Verification: documentation diff review.

## NAV-002 — Shared typed document query
- Goal: make Home/Lectures/Sheets/Search share one optional type filter.
- Scope: Course counts, years, semester documents, search.
- Files/modules affected: document repository/controller/routes/service.
- Dependencies: NAV-001.
- Acceptance criteria: omitted type returns both; Lecture/Sheet return only their category with matching counts.
- Tests: backend typed hierarchy/search integration.
- Verification: `npm run test:backend`.

## NAV-003 — Shared hierarchy UI
- Goal: give Home, Lectures, and Sheets the same Course → Year → Semester flow.
- Scope: generic catalog, reusable detail/year panels, routes, consistent actions/states.
- Files/modules affected: user components/router.
- Dependencies: NAV-002.
- Acceptance criteria: typed catalogs contain only non-empty relevant Courses; actions and counts agree.
- Tests: Vue hierarchy/category tests.
- Verification: `npm run test:frontend`; `npm run build`.

## NAV-004 — Upload navigation restructure
- Goal: make Upload the single user-facing upload/history section.
- Scope: main nav, tabbed Upload page, legacy request redirect, internal links.
- Files/modules affected: dashboard nav/router, Upload/request components.
- Dependencies: NAV-001.
- Acceptance criteria: one form instance; Upload Material and My Uploads available; no standalone request nav.
- Tests: navigation/upload component tests.
- Verification: `rg` route/render checks; frontend tests.

## NAV-005 — Profile contributions
- Goal: simplify Profile and count every submission exactly once.
- Scope: contribution API, statistics, recent contribution links, avatar/identity UI.
- Files/modules affected: upload repository/controller/routes/service, Profile.
- Dependencies: NAV-004.
- Acceptance criteria: both types counted from owned requests; approval changes status count but not total; no upload form in Profile.
- Tests: ownership/count lifecycle and Profile component tests.
- Verification: backend/frontend tests.

## NAV-006 — Search/category/publication regression
- Goal: verify global and contextual search and publication routing.
- Scope: user/admin Lecture/Sheet flows and shared source consistency.
- Files/modules affected: integration tests.
- Dependencies: NAV-002–005.
- Acceptance criteria: Home/global includes both; typed paths never leak; public actions work.
- Tests: user1/user2/admin1 scenarios, duplicates, permissions.
- Verification: `npm test`.

## NAV-007 — UX, regression, and deploy readiness
- Goal: validate responsive-safe layouts, build, migration, production startup, and Thai review.
- Scope: changed UI/styles/docs and command matrix.
- Files/modules affected: frontend styles, README, `CODE_REVIEW_TH.md`.
- Dependencies: all prior tickets.
- Acceptance criteria: loading/empty/error states, no broken legacy links, passing automation, truthful visual status.
- Tests: frontend tests, lint, build, production health/SPA smoke.
- Verification: `npm run db:migrate`; `npm test`; `npm run lint`; `npm run build`; production HTTP smoke.
