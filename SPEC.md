# Course Document Navigation and Contribution Specification

## Current-state findings and preserved architecture

The application remains Vue 3 + Express 5 + SQLite with separate Lecture and Sheet domain/file tables, private `upload_requests`, transactional publication, JWT/refresh authentication, role middleware, and the unified approved-document SQL read model. No new publication table, Course copy, year table, semester table, search index, or contribution table is needed.

## Final navigation and responsibilities

The user main navigation is exactly Home, Lectures, Sheets, Upload, Profile. Global Search remains reachable from Home but is not a sixth primary item. `/dashboard/requests` is a compatibility redirect to `/dashboard/upload`.

- Home: all published Lecture and Sheet documents through Course → Year → Semester → Documents.
- Lectures: the same hierarchy/query with structured `documentType=Lecture`.
- Sheets: the same hierarchy/query with structured `documentType=Sheet`.
- Upload: one canonical `DocumentUploadForm` plus the current user's persistent upload/request history.
- Profile: safe identity/avatar presentation plus contribution statistics and recent contributions; no upload form or admin controls.

## Shared hierarchy and actions

One repository query accepts optional Course, academic year, semester, and document type filters. Course cards use View, year cards use More, and document cards use View/Download consistently. Only groups containing accessible approved files appear in typed catalogs. Counts are computed from the same filtered public rows returned by lists/search. Empty, loading, and safe error states are required.

## Upload and publication

Upload explicitly collects Course, year, semester, Lecture/Sheet type, title, instructor, and file. Normal-user requests stay PENDING until admin approval. Publication preserves structured type, automatically makes a Lecture visible in Home/Lectures or a Sheet in Home/Sheets, and never requires duplicate manual creation. History is read from persistent `upload_requests`, so approved items remain as COMPLETED/published.

## Profile and contributions

One upload-request row equals one contribution throughout its lifecycle. Contribution totals are aggregated only from the authenticated user's `upload_requests`: total, Lecture, Sheet, published (`COMPLETED`), pending (including processing/approved transitional states), and rejected/failed. Recent items retain public IDs and request IDs. Published contribution links open its Course/year context; private/rejected links open Upload history.

## Search

The existing global search uses the unified approved source with no type filter. Lecture and Sheet catalog search calls the same endpoint with a validated structured type filter. Search covers title, filename, Course code/name, year, and semester. No filename/title inference is permitted.

## API and database impact

- Extend `GET /api/courses`, course-year endpoints, and `GET /api/documents/search` with optional `type=Lecture|Sheet`.
- Add `GET /api/upload-requests/contributions`, protected as USER and derived from request ownership.
- No new schema migration is required for this follow-up; existing request/public links and hierarchy fields are reused.

## UI component strategy

Use a shared typed Course catalog component and reuse the current Course detail/year components with props for type and route base. Reuse, do not duplicate, `DocumentUploadForm` and `UserRequestsPanel` inside a tabbed Upload panel. Simplify Profile and load one contribution payload.

## Permissions and duplicates

All public queries remain authenticated and approved-only. Contribution/history endpoints use `req.user.id`. Request file ownership and admin routes remain unchanged. SHA-256 exact detection, normalized metadata possible detection, pending matches, reject-as-duplicate, and idempotent approval must continue passing unchanged.

## Test strategy and regression risks

Backend tests cover type-filtered counts/years/semesters/search plus one-row contribution counting before/after approval. Frontend tests cover exact navigation, legacy redirects, Upload tabs/canonical form, Profile without upload form, dynamic contribution totals, and typed catalog rendering. Existing three-actor, duplicate, privacy, auth, migration, lint, build, startup, and health checks are rerun. Main risks are stale links to `/requests`, double-rendered upload forms, status terminology, and typed count/list disagreement.
