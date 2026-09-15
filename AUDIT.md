# CSIT Sheet Master Renovation Audit

## Repository and architecture

- Monorepo npm workspaces: Vue 3/Vite/Vue Router/Axios frontend, Express 5/SQLite backend.
- Authentication uses access/refresh JWT cookies and role middleware. USER and ADMIN areas are route-guarded; upload ownership protects private submissions.
- `upload_requests` is the submission lifecycle source of truth. Approval transactionally creates one Lecture or Sheet and links it by a unique `source_request_id`.
- Approved Lecture and Sheet records stay separate for writes and are combined by the existing read-only document repository for Home, course/year/semester, typed catalogs, search, view and download.
- `file_assets` already provides SHA-256 binary deduplication. Domain file rows and requests reference the shared asset. Reference-aware cleanup and a delete-protection trigger exist.
- `document_interactions` and `document_helpful_votes` already enforce unique actor/document activity, exclude self-reward and feed the dynamic contribution score.

## Current data lifecycle

USER upload -> validation -> server SHA-256/content fingerprint -> duplicate classification -> shared asset -> PENDING request -> ADMIN review -> APPROVED/REJECTED -> one public Lecture/Sheet -> discovery and qualified View/Download/Helpful -> derived contributor score, level and badges.

Existing duplicate precedence is EXACT_DUPLICATE, CONTENT_DUPLICATE where extraction is supported, POSSIBLE_DUPLICATE, then NONE. Pending and public matches participate. Filename changes cannot bypass SHA-256. Metadata proximity alone is only a warning.

## UX/UI findings

- The current product mixes English and Thai, uses a dark theme, and presents dense admin tables. It does not meet the requested warm, Thai-first, human-centered product direction.
- The user shell has the correct five primary destinations and keeps upload history inside Upload, but Search is only reachable from Home and mobile navigation is incomplete.
- Document cards show impact but contributor identity is plain text, not a reusable avatar/name/username component and not clickable.
- There is no public contributor route or privacy-safe contributor search API. `users` has `username` and avatar but no display name.
- Own Profile already has private identity, contribution analytics, score, levels and badges. Its visual hierarchy and copy need renovation, not a second contribution system.
- Upload already has drag/drop, validation and history filters. It needs Thai-first states, clearer grouping and responsive polish.
- Admin review exposes duplicate evidence and actions, but all rows/actions compete in one table, rejection uses `window.prompt`, and there is no dedicated preview/metadata/comparison workspace.
- Empty/loading/error patterns exist but are visually inconsistent. Long strings need explicit `min-width: 0`, wrapping, clamping and responsive grid rules.

## Passionfroot reference analysis

Public Passionfroot pages were reviewed on 2026-09-14: the main site, Creator Gallery, Storefront guide and workspace/navigation guides. Reusable design principles are warm neutral backgrounds, near-black type, selective high-energy accents, large rounded modules, strong whitespace, creator identity as a first-class object, measurable proof, and action-oriented workspaces. CSIT Sheet will translate these principles without copying branding, assets, text or exact layouts.

Sources:

- https://www.passionfroot.me/
- https://www.passionfroot.me/creator-stories
- https://help.passionfroot.me/en/articles/11552776-storefront
- https://help.passionfroot.me/en/articles/11552873-faqs
- https://help.passionfroot.me/creators/the-basics/navigating-your-workspace

## Database/API gaps

- Add nullable/defaulted `users.display_name`, backfill from username, index lowercase lookup, and return it from authenticated safe-user DTOs.
- Add privacy-safe authenticated contributor endpoints: partial case-insensitive search and public profile by username. Responses must never select/return email, password, tokens, pending/rejected uploads or admin-only fields.
- Extend public document DTOs with avatar and display name while retaining username as stable routing identity.
- Reuse current aggregate/score rules; public search must use set-based aggregates rather than per-result queries.

## Reuse and refactor decision

Keep the schema lifecycle, repositories, authorization, upload pipeline, approval transaction, duplicate pipeline, shared storage, contribution rules, navigation hierarchy and existing API contracts. Add the contributor read model and display-name migration, refactor shared UI identity/status/dialog primitives, and renovate the existing screens in place.

## Verification baseline and risks

- Existing automated baseline before this renovation: backend 27 passing, frontend 8 passing, lint/build/migration/production smoke previously passing.
- Production dependency audit previously had zero production vulnerabilities; moderate findings were dev-only Vitest transitive dependencies.
- Main risks: accidentally leaking private fields, N+1 contributor search, object URL cleanup, breaking approval idempotency, translating backend enums, mobile action overflow and reporting visual PASS without a real browser.
- Browser visual runtime is unavailable in the current tool session. Visual QA must remain NOT RUN unless a real browser connection becomes available; automated responsive assertions are not a substitute.
