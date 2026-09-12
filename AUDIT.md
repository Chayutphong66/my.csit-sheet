# Repository Audit

## Current architecture

- Frontend: Vue 3, Vue Router, Axios, Vite, and Vitest. Auth state and refresh handling live in stores/services; user and admin dashboards share `DashboardShell`.
- Backend: Express 5 controllers/routes over repository modules. Authentication uses short-lived JWT access tokens and rotated hashed refresh tokens. `requireAuth` and `requireRole` enforce API permissions.
- Database: SQLite through Node's built-in `node:sqlite`. `database.js` performs idempotent in-place migrations; explicit migrate and development-only seed commands already exist.
- Content: Lecture and Sheet are deliberately separate public domain tables with matching `lecture_files` and `sheet_files` BLOB tables. `upload_requests` is the private workflow record and temporary file store.
- Publication: admin approval uses `publishUploadRequest`, a transaction, `source_request_id` uniqueness, and request links to make publication idempotent. Admin direct upload reuses the same path and publishes immediately.
- Existing public access: authenticated users list approved Lecture/Sheet records and download their public file records. Request files are owner-only or admin-only.
- Existing UI: Home, separate Lecture/Sheet catalogs, Profile upload, own request history, and admin request/direct-upload panels.
- Deployment: one Node service can serve the Vite build; health check, environment template, CI, lint, tests, migration, seed, and production scripts exist.

## Gaps and risks found

- Academic years are hard-coded by `/sheets/metadata`; semesters do not exist in the schema or forms.
- Courses only have `id` and `name`; published rows primarily store a `subject` string, so course identity and descriptions/codes are inconsistent.
- Home derives course chips and counts in the browser from two catalog calls and links every course to the Sheet page.
- Search is client-side and split by catalogs; it does not search filename, year, or semester through one server-side published source.
- Public file routes only send `attachment`; there is no authorized inline preview endpoint.
- SHA-256, normalized titles, exact/possible duplicate classification, pending-request comparison, match display, and reject-as-duplicate are absent.
- Admin request preview downloads rather than opens inline and has no duplicate warning.
- Sheet year/type/instructor metadata is recovered by joining its source request; the hierarchy needs stable structured fields on each public material.
- Seeded legacy records can lack files and course IDs. Migrations must preserve them without making missing files publicly retrievable.
- Request status `COMPLETED` means approved and published, while public materials use `APPROVED`; this consistent distinction should be retained.

## Reuse/refactor decision

Keep authentication, role checks, Course data, Lecture/Sheet tables, file tables, upload validation, request ownership, transactional approval, notifications, API client, dashboards, and deployment model. Extend both content tables with common hierarchy metadata and add a read-only unified document repository/API using SQL `UNION ALL`; do not create another document table or search index.

## Navigation/profile follow-up audit

- Current user navigation still exposes both Search and My Upload Requests; the requested final navigation requires exactly Home, Lectures, Sheets, Upload, Profile.
- `DocumentUploadForm` is rendered only by Profile, while request history is a separate route. These can be moved/reused without copying either implementation.
- Profile currently mixes identity, upload, and notifications and has no contribution aggregation.
- Existing Lecture and Sheet pages call separate legacy catalog APIs and apply browser-side filters, so they do not yet reuse the Course hierarchy/read model.
- The unified document repository already provides the correct public source; it needs an optional structured `documentType` filter shared by Course counts, years, semesters, lists, and search.
- `upload_requests` persists after publication and links to the public Lecture/Sheet. Counting this table once per row is the correct contribution source and avoids counting request + public record twice.
