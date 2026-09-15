# CSIT Sheet Master Renovation Specification

## 1. Current architecture
Preserve Vue 3/Vite/Vue Router/Axios, Express 5, SQLite, repository/controller/service boundaries, cookie JWT auth, USER/ADMIN guards and npm workspaces.

## 2. Current DB schema
Reuse users, courses, instructors, upload requests, Lecture/Sheet metadata and file rows, notifications, refresh tokens, shared file assets, interaction ledger and Helpful votes. Add only `users.display_name` plus its lookup index.

## 3. Current data lifecycle
One request remains one logical contribution. Approval creates exactly one public typed document; public reads combine approved Lecture and Sheet rows. Interactions attach only to approved documents.

## 4. Current UI problems
Dark/English-heavy styling, inconsistent hierarchy, non-clickable contributors, incomplete mobile navigation, and insufficient long-text guarantees conflict with the requested experience.

## 5. Current Admin UX problems
The review table is dense, all actions appear at once, preview leaves context, and native prompts do not provide a safe, accessible review flow.

## 6. Passionfroot reference analysis
Translate warm neutrals, bold type hierarchy, generous whitespace, rounded modular surfaces, selective lime/soft accents, human identity, visible metrics and next-action emphasis. Do not copy proprietary assets, language or exact layouts.

## 7. New Design System
One global token layer governs semantic colors, type, spacing, radius, borders, shadows, icon/control sizes, layout widths, breakpoints and motion. Existing semantic class contracts are retained where useful.

## 8. Color tokens
Use warm cream background, white/warm surfaces, near-black primary text, warm gray secondary text, lime primary accent, and restrained lavender/yellow/peach/green soft surfaces. Semantic success/warning/danger/info always include text labels.

## 9. Typography
Use a Thai-compatible system stack (`Leelawadee UI`, `Tahoma`, `Noto Sans Thai`, sans-serif), unitless comfortable Thai line-height, and tokenized display/title/body/label/caption sizes.

## 10. Spacing
Use a 4/8/12/16/24/32/48/64 scale with consistent panel, card, control, icon and section gaps.

## 11. Radius/borders/shadows
Controls use small radius, cards medium, panels large. Prefer subtle warm borders and minimal low-elevation shadow.

## 12. Motion
Use 160–240ms transitions for hover, press, tabs, dialogs, cards and skeletons. Disable non-essential motion under `prefers-reduced-motion`.

## 13. Thai/English terminology
Central presentation maps translate navigation, status, document type, duplicate status and actions. Persisted/API enums remain `Lecture`, `Sheet`, `PENDING`, `COMPLETED`, `REJECTED`, and duplicate enums.

## 14. User navigation
Keep exactly หน้าแรก, เอกสารการสอน, ชีทสรุป, อัปโหลด, โปรไฟล์. Add a discoverable Search control without a separate My Upload Requests nav item. Mobile gets an accessible menu.

## 15. Course browsing
Home -> Course -> dynamic Academic Year -> dynamic Semester -> approved documents. Counts and filters remain data/visibility-aware; Buddhist years are displayed without conversion.

## 16. Document UI
Cards prioritize title, type, course, year/semester, contributor, Views/Downloads/Helpful and actions. Internal hashes/storage IDs never render publicly. Long content wraps or clamps with full accessible text.

## 17. Contributor identity
Create one identity primitive with avatar/initial fallback, display name, `@username` and profile link. Public document queries supply those fields.

## 18. Public Profile
Authenticated route `/dashboard/users/:username`. Response contains only avatar, display name, username, derived level, public contribution summary, badges and approved recent documents.

## 19. User Search
Authenticated case-insensitive partial search across username/display name. Unified Search shows separate เอกสาร and ผู้แบ่งปัน sections and never exposes email or private workflow state.

## 20. Upload UX
Keep one structured form and server validation. Renovate drag/drop, metadata grouping, loading/error/success feedback and file-size/type messaging in Thai.

## 21. My Uploads
Remain a tab inside Upload. Keep status/type filters, rejection/duplicate reasons, readable history and navigation to public output where available.

## 22. Own Profile
Show private account identity only to the owner, with display name fallback, contribution overview, analytics, recognition and notifications. Link to the safe public profile.

## 23. Contribution Analytics
Reuse authoritative public impact aggregates: approved count by type, qualified views/downloads, Helpful, recent contribution impact and request totals.

## 24. Helpful
Keep idempotent per-user vote, server-derived actor, published-target check and self-vote rejection. UI exposes pressed state and Thai feedback.

## 25. Score
Keep dynamic server calculation: rewardable completed contribution 20, qualified unique non-owner download 2, non-owner Helpful 5, View 0. Client cannot submit score.

## 26. Level
Derive from centralized score thresholds. Never persist a client-controlled level.

## 27. Badges
Derive deterministic badges from authoritative contribution/impact thresholds. Duplicate/rejected requests cannot count.

## 28. Duplicate Detection
Reuse one classifier with precedence exact -> supported content -> metadata possible -> none, against pending and approved records. Same hierarchy alone is not a duplicate.

## 29. Storage Dedup
Reuse `file_assets(binary_hash UNIQUE)` and references from requests/public file rows. Cleanup only unreferenced assets; DB trigger protects shared references.

## 30. Admin Dashboard
Default Admin entry opens an action-needed overview with pending/rejected/published/user counts and a direct queue CTA, not a generic metric wall.

## 31. Admin Queue
Use readable review cards/list with summary counts and one ตรวจสอบ action per pending item. Preserve status visibility and avoid dense action columns.

## 32. Approval Workspace
Selected item opens an in-context responsive split workspace: preview left, structured metadata/contributor right, sticky actions below; stacked on narrow screens.

## 33. Duplicate Comparison
Show New versus Existing/Pending matches with match type, binary/content signals and safe existing-document actions. Reject as Duplicate uses a confirmation dialog.

## 34. Permissions
USER endpoints require authentication. Public-profile means visible to authenticated platform users, not anonymous. ADMIN endpoints remain role-only; upload history remains owner-only.

## 35. Security
Whitelist public contributor fields, validate/sanitize query and route input, limit results, do not select BLOBs in analytics/search, retain upload/file authorization and server-calculated recognition.

## 36. Responsive strategy
Mobile-first behavior covers 375, 768, 1024 and 1440 CSS ranges. Grids collapse, navigation becomes a menu, tables scroll only where irreducible, sticky actions remain reachable and controls meet touch size.

## 37. Accessibility
Semantic headings/nav/forms/buttons, associated labels, visible focus, `aria-current`, dialog role/focus behavior, escape/overlay close, descriptive status text, contrast, keyboard operation and reduced motion.

## 38. Migration/backfill
Idempotently add `display_name TEXT NOT NULL DEFAULT ''`, backfill empty values from username, then create a lowercase lookup index. Existing users/files remain unchanged otherwise; migration must pass FK check twice.

## 39. API changes
Add `GET /api/contributors/search?q=` and `GET /api/contributors/:username`; extend authenticated user/document DTOs with `displayName`/`uploaderDisplayName`/`uploaderAvatarUrl`. Existing API fields remain compatible.

## 40. Tests
Backend covers migration, safe profile/search DTOs, partial/case-insensitive lookup, public-only docs, roles, 3 actors and existing interaction/duplicate/idempotency suites. Frontend covers terminology, contributor links/search/profile, admin workspace/dialog and responsive/design semantics.

## 41. Visual QA
Required real-browser matrix: user and admin routes at 375/768/1024/1440 plus long Thai/English strings, motion and reduced motion. Report NOT RUN when browser runtime is unavailable; never infer PASS from build/tests.

## 42. Regression risks
Guard typed catalog filtering, route guards, object URL cleanup, empty seed files, approval retry, private data, duplicate precedence, count semantics, notification behavior and legacy API compatibility.

## 43. Deployment impact
Run idempotent migration before backend start, then frontend production build. No new runtime dependency or external service is required. Deployment remains blocked only by failed checks or unresolved visual QA policy.
