# CSIT Sheet — Existing-System Renovation Specification

Updated 2026-09-15. This specification supersedes the earlier cream/lime Passionfroot visual direction. The source is the supplied master prompt's getdesign.md Starter Kit palette and composition requirements. A standalone reference HTML file was not included; this is a translation of the written design direction, not a claim of pixel matching to unseen HTML.

## Existing architecture and schema

Preserve the npm workspace monorepo, Vue 3.5/Vite 6/Vue Router/Axios frontend and Express 5/SQLite backend. Retain routes, reactive auth/notification stores, API services, controllers, validation, repositories, JWT access/refresh flow, USER/ADMIN route guards and ownership checks. Do not introduce a second application, static HTML replacement, CDN Tailwind, inline event handlers or new runtime dependencies.

The existing schema includes users/display_name, courses, instructors, upload_requests, separate lectures/sheets and file rows, refresh_tokens, notifications, file_assets, document_interactions and document_helpful_votes. The previous additive display-name migration/backfill/index already exists. This renovation requires no new schema; verify existing migrations twice on a fresh isolated database and check integrity/foreign keys. Do not reset or reseed the real database.

## Audit findings and target

Contributor identity/search/profile, impact, upload history, duplicate classifier, shared storage and Admin workspace already exist. Verify and retain them. Remaining gaps: overly simple Starter, older cream/lime tokens, tight Thai heading line-height, stale reused typed catalogs on SPA navigation, out-of-order async profile/preview responses, missing approval confirmation/success feedback, missing pending-file comparison actions, and production CSP blocking Blob iframe previews.

Reuse the current modular architecture. Extend its UI/token contracts, guard async responses, key nested user views by route, select metadata explicitly in queues and calculate contributor interaction aggregates independently. APIs remain compatible; no enum/schema rewrite is justified.

## Document and contributor lifecycle

USER -> structured upload -> server validation/SHA-256/supported content hash -> duplicate classification/storage asset -> PENDING -> ADMIN review -> APPROVED/publication -> COMPLETED request -> one Lecture or Sheet -> discovery/view/download/Helpful -> server-derived contributor recognition. Keep the existing Admin direct-publication workflow compatible. Approval transaction/retry creates one public record, contribution and storage reference. No client-controlled score, status, uploader, level or badge.

Public read models combine only approved Lecture/Sheet rows and share the same visibility predicate for lists/counts/search/course hierarchy/file access. Pending/rejected files remain owner/Admin-only. One submission remains one contribution before and after approval. Legacy contributor links remain unknown when reliable provenance is unavailable; do not invent users.

## Central design system

Use existing `--color-*` semantic contracts with #FCF8FA background, #F8F9FA/#F6F3F4/#FFFFFF surfaces, #111827 primary and #4B5563 secondary text, #000000 primary actions, #E5E7EB borders. Purple #8B5CF6 is restrained; #6D28D9 supports readable purple text. #10B981 marks positive signals; #0058BE supports links. Muted text uses darker #687280 rather than low-contrast #9CA3AF. Dark features use #0B0D11/#13161C/#1C2029 with #27272A borders and pale text. Most cards are neutral; colors for semantic states always include text.

Thai-compatible system font stack: Leelawadee UI/Tahoma/Noto Sans Thai/Arial. Unitless heading line-height 1.4 or greater, body 1.65, responsive editorial headings, no Thai marks clipped. Cascadia Code/Consolas/monospace only for numeric labels/technical metadata. Root HTML language is Thai. Retain the 4/8/12/16/24/32/48/64 spacing scale, tokenized radii/borders/subtle shadows, 44px controls and semantic CSS classes. Use existing reusable identity/status/dialog components and simple glyphs/SVG, no unrelated icon dependencies.

## Starter and authentication

Renovate existing `LandingView.vue`: navigation, original Thai hero, auth-aware Browse/Share CTAs, embedded labelled product concept demo, static topic vocabulary in an animated marquee, problem statement/Bento capabilities, dark contribution-value section, four-step community loop, final CTA/footer. No fabricated contributors/documents/activity/statistics. Anonymous users authenticate before browsing; Starter uses non-numeric product communication because no anonymous aggregate API exists.

Demo typing/results/Helpful and marquee run autonomously in CSS, separate from real inputs. A visible pause button stops motion; the demo pauses outside the viewport. Viewport reveal never hides content permanently and degrades to static content without IntersectionObserver. Respect reduced motion by disabling animation, revealing the full decorative query and displaying one wrapped static topic group. Navigation honors reduced-motion scrolling.

Retain existing Login/Register forms, validation and auth flow; new shared tokens align them with the product. Keep distracting motion away from inputs. The former 2.1MB hero PNG is no longer imported by Starter or emitted in its production bundle.

## User navigation and discovery

Keep five primary destinations: หน้าหลัก, เอกสารการสอน, ชีทสรุป, อัปโหลด, โปรไฟล์, plus Search shortcut and mobile menu. Upload history remains within Upload. Key nested RouterView by full route so shared catalog/course/year/selected-upload views reload correctly on SPA navigation.

Home combines both types. Course -> actual Buddhist academic year -> actual semester -> approved documents; no hard-coded years or type inference from title/filename. Keep backend canonical `Lecture`/`Sheet` values compatible, mapping only labels in the presentation layer. Typed catalogs remain isolated. Document cards show type/title/course/year/semester/clickable contributor/qualified impact with safe view, original download and Helpful actions using the same authoritative file.

Unified Search separates document and contributor results. Existing document API searches course code/name, title/file/year/semester; contributor API safely searches username/displayName with bounded prepared queries. Accept UI `@username` by stripping the decorative @ only for contributor lookup. Public contributor API retains its field whitelist, excludes credentials/email/tokens/private workflow and never selects file BLOBs.

## Profiles and contributor ecosystem

Retain authenticated public route `/dashboard/users/:username` and `GET /api/contributors/search?q=` / `GET /api/contributors/:username`. “Public” means visible to authenticated USERs within the existing permission model, not anonymous access. Safe profile: displayName/username/avatar, public type counts, downloads/Helpful, derived score/level/badges and recent approved documents. Guard load generations so earlier profiles cannot overwrite later navigation or update a disposed view.

Own Profile retains owner-only identity/account fields, private contribution totals/statuses, impact, score/level/badges, recent contributions and notifications. Upload form remains outside Profile. Shared UserIdentity uses an avatar/initial fallback and links only reliable contributor usernames.

## Upload and history

Retain existing server/client size/type/signature checks, drag/drop/browse, title/course/instructor/year/semester/type/file metadata, file selection and busy/error/success feedback. Do not fake progress. My Uploads retains type/status filters, timestamps, publication destination and rejection/duplicate evidence. Upload tabs have related tab/panel IDs, roving tabindex and Arrow/Home/End keyboard support; focus remains visible on the file dropzone.

## Contribution analytics, Helpful and recognition

Keep centralized score: rewardable completed contribution 20, qualified unique non-owner download 2, active non-owner Helpful 5, View 0. DB uniqueness enforces one actor/document/interaction kind and one active Helpful vote. Self-vote is rejected server-side; repeated downloads do not farm score. Duplicate/rejected submissions earn no contribution points. Levels/badges remain deterministic and grant no permissions.

Aggregate downloads and Helpful in separate grouped CTEs rather than joining all votes to all interactions. Explicitly exclude legacy owner rows from reward aggregates and reconcile multiple documents against known test totals. Queue/list/search/profile queries select metadata only; file bytes are loaded solely for preview/download/extraction.

## Duplicate detection and storage

Retain precedence EXACT_DUPLICATE -> supported CONTENT_DUPLICATE -> POSSIBLE_DUPLICATE -> NONE against pending/public rows. Server SHA-256 survives renamed files. Content extraction is bounded and conservative for text/simple text-based PDFs; compressed/encrypted/image-only/complex PDFs and unsupported types safely fall back. Matching hierarchy alone cannot classify a document as duplicate; possible matching includes normalized title and requires Admin judgment. Do not fabricate percentages.

Retain `file_assets(binary_hash UNIQUE)` and request/public file references, reference-aware orphan cleanup and delete-protection trigger. Exact binary reuse stores one BLOB, regardless of renamed submissions. Publication adds references, never copies bytes. No duplicate count/search/score inflation; preserve existing cleanup/report commands.

## Admin review

Retain action-needed Dashboard, queue, preview/structured metadata/contributor workspace, split/stack layout, duplicate comparison and sticky decision bar. Discard stale preview responses and revoke replaced/disposed object URLs. Pending match files use the ADMIN request-file endpoint; published match files use approved document endpoints. Labels explain exact/content/metadata evidence.

Confirm approval/rejection/duplicate rejection through existing accessible dialog, capture the decision request ID, prevent repeated/busy decisions and disable selection/refresh during confirmation. Rejection needs a bounded reason; successful decisions show status feedback and load the next pending item. Existing read-only user/course/instructor Admin views are retained.

## Profile follow-up: document-focused layout

Profile retains the existing theme and uses a persistent identity sidebar with Overview, Documents, Upload Requests and Stars. Existing `/dashboard/profile` and `/dashboard/users/:username` routes use `?tab=documents|requests|stars`, supporting direct URLs, refresh and browser history. Edit profile changes the authenticated actor's display name only. Unsupported bio/followers are hidden.

Overview ranks up to six public Sheet/Lecture documents by actual Stars, downloads and publication date. A rolling 365-day contribution calendar counts publication/update timestamps and owner-only upload events; views never count. Documents and Stars support search, type, dynamic subject and date/popularity/download sorting. Existing approved-document viewing/download/Helpful services are reused. Upload Requests reuse the owner-scoped request query and existing statuses without duplicating the upload form. Owner notifications and private account metadata remain available.

Inspection found no saved-interest model. The idempotent `document_stars` table uses primary key `(user_id, document_type, document_id)` and user foreign key. Stars are independent of Helpful and contribution score. Writes validate authenticated identity, boolean state and approved public document existence. Reads join approved documents, excluding hidden documents. Another user's request metadata and upload activity never enter the API response. No private-document visibility model is invented.

## Academic offerings and upload metadata

The internal Course catalog is populated from the NU Information Technology curriculum JSON and never fetched from NU at request time. Course codes are unique; bilingual names, credits and category remain seed-managed. Existing Course IDs and documents remain valid. Teachers extend the existing instructors table with normalized unique names, optional email, active state and timestamps. Production curriculum seed contains no teachers or offerings.

`course_offerings` uniquely identifies Course + Buddhist Era academic year + controlled semester + optional section. `course_offering_teachers` supports team teaching with a composite primary key. Upload teacher selection queries this relationship using course/year/semester and resets whenever a dependency changes. Teacher is optional; when supplied, backend validation requires an active teacher assigned to the exact period and stores the offering reference plus the existing immutable name snapshot.

Teacher suggestions start PENDING and uniquely suppress equivalent pending submissions by actor/context/normalized name. Admin approval transactionally creates or reactivates the normalized Teacher, finds or creates the Offering, inserts the relationship idempotently and marks the suggestion APPROVED. Rejection creates no relationship. USER endpoints can read curriculum/available teachers and submit suggestions. ADMIN endpoints manage teachers, offerings and decisions; every authorization rule is server-side.

## Security and accessibility

Retain scrypt password migration, short-lived access JWTs, rotated/revoked refresh tokens, HttpOnly/Secure/SameSite cookies, explicit CORS origins, Helmet, rate limiting, prepared SQL, role/ownership validation, filename/path/size/MIME checks and safe Content-Disposition. Only add `frame-src 'self' blob:` to CSP for authenticated document previews; retain self-only scripts and other Helmet directives. Production requires HTTPS and correct ALLOWED_ORIGINS, including its own frontend origin for crossorigin module/assets and API requests.

Semantic main/nav/headings/forms/buttons, associated labels, Thai document language, skip link, visible focus, readable contrast, non-color status descriptions, Helpful pressed state, mobile expanded/control IDs, keyboard upload tabs, focus-trapped dialog with Escape/restoration. Mobile controls/compare actions are 44px. Screen-reader compatibility is based on semantics and keyboard verification; no exhaustive assistive-technology certification is claimed.

## Responsive, performance and QA

Targets: 375/768/1024/1440. Preserve `min-width:0`, wrapping, flexible actions, collapsing grids, mobile menu and stacked Admin comparison/workspace. Very long Thai titles/names/English filenames must not overlap or overflow. Use restrained CSS motion and no expensive JS loops; avoid N+1/BLOB-heavy metadata requests.

Run `npm test`, `npm run lint`, `npm run build`, migration/foreign-key checks and supported production startup/health checks. Backend isolated 3-actor HTTP integration covers upload/privacy/publication/type filters/impact/anti-abuse/duplicate/storage/retry; frontend tests cover critical interaction/navigation/state contracts.

`npm run test:visual` uses Node built-ins plus an installed Chromium/Edge executable, local OpenSSL-generated temporary HTTPS certificate, fresh SQLite data, isolated user1/user2/admin1 fixture sessions and a fresh browser profile. Production CSP/CORS/cookies/rate limiter remain enabled. Capture key screens, long strings, preview/comparison/dialog at all four widths; assert overflow bounds, security logs, pause/reduced motion and Tab/Escape focus. Inspect screenshots separately; bounds alone do not prove visual quality. Results are written to ignored `artifacts/visual-qa/`. No package dependency is added; unsupported hosts can set BROWSER_EXECUTABLE and OPENSSL_EXECUTABLE.

## Deployment and regression

No new external service/schema/runtime dependency. Build and migrate before startup; back up existing SQLite and retain persistent storage. Do not seed production. Configure NODE_ENV/JWT_SECRET/DATABASE_PATH/ALLOWED_ORIGINS and HTTPS using existing deployment topology. Verify authentication, every user route, typed hierarchies, upload/history/profile/contributor/search/view/download/Helpful, recognition, duplicates/storage and Admin approvals after changes. Report only executed PASS/FAIL; unsupported checks stay NOT RUN with a reason. Final Thai review has the requested 22 sections and one deploy-readiness status.
