# Phase 7B.1 — Ephemeral Supabase Storage Verification

## Safety boundary

Phase 7B.1 provides a manual GitHub Actions lane backed only by a Docker-based Supabase Local stack on the GitHub-hosted runner. It does not connect to a hosted Supabase project, read GitHub Environment storage secrets, run `supabase link`, run `supabase db push`, deploy an application, merge to `main`, or run a production migration.

Production Supabase URLs, keys, buckets, database URLs and project references are prohibited in this lane. The workflow obtains a local API URL and local stack key directly from `supabase status` after the stack starts. The local key is masked immediately and is discarded with the runner.

## Workflow architecture

`.github/workflows/external-storage-verification.yml` remains `workflow_dispatch` only with `contents: read`. A dispatch must explicitly confirm `LOCAL-EPHEMERAL`. The job:

1. uses commit-SHA-pinned checkout, Node setup, artifact upload and Supabase CLI setup actions;
2. installs an exact Supabase CLI version;
3. initializes and starts a fresh Supabase Local stack with the Docker runtime;
4. validates that the API origin is exactly the default loopback endpoint;
5. loads credentials only from that local stack and never from GitHub secrets or variables;
6. creates a private local bucket named `csit-sheet-phase7b-test` through the local Storage API;
7. runs the storage adapter and application integration suites with SQLite;
8. uploads boolean/status-only evidence; and
9. destroys the local stack with `supabase stop --no-backup` even after failure.

Concurrency is scoped to the workflow branch. The job timeout is 25 minutes. The workflow never links the working directory to a hosted project.

## Fail-closed guards

`EXTERNAL_STORAGE_TEST_MODE=local-ephemeral` activates guards in application configuration before database initialization or Storage requests. The guard requires:

- `NODE_ENV=test`, `DATABASE_DRIVER=sqlite` and `STORAGE_DRIVER=supabase`;
- an HTTP origin whose hostname is `127.0.0.1`, `localhost` or `::1`;
- credentials sourced from `supabase-local-status`;
- no `DATABASE_URL` or `TEST_DATABASE_URL`;
- no `TEST_SUPABASE_*`, `PRODUCTION_SUPABASE_*` or legacy `SUPABASE_SERVICE_ROLE_KEY` variables;
- the dedicated local test bucket, never `documents`; and
- an exact run-specific prefix `phase7b/<run-id>`.

`SUPABASE_STORAGE_PREFIX` is rejected outside local-ephemeral mode, so it cannot silently alter production object keys. The adapter adds the run prefix only to the remote object path while SQLite retains the normal logical `sha256/<hash>` reference.

## Verification coverage

The lane checks:

- private bucket metadata;
- authenticated upload/download, byte integrity and metadata;
- content-addressed idempotency and same-key/different-content rejection;
- missing-object behavior and unauthenticated access rejection;
- retry after a simulated transient failure and partial-failure isolation;
- Collection cover upload/remove through the application API;
- non-disclosure of private object keys in API responses;
- reference-aware database cleanup that preserves referenced assets;
- secret-free provider error diagnostics; and
- manifest-only deletion followed by absence checks.

Every remote object path starts with `phase7b/<run-id>/`. Cleanup iterates only the in-memory manifest of keys attempted by that test run. The lane contains no empty-bucket or list-and-delete operation.

## Evidence and limitations

The `phase7b1-ephemeral-storage-evidence` artifact contains status booleans only. It excludes URLs, keys, bucket names, run IDs, object keys, database paths and response bodies.

A green run proves the Storage adapter and application/API semantics against Supabase Local Storage. It does **not** prove hosted production networking, hosted project configuration, production credentials, hosted Storage policies, production data compatibility or deployed browser behavior. Hosted production-like external storage verification remains a separate release blocker requiring its own safe design and approval.

PDF rendering, Sequential Reader behavior, object URL revocation, session expiration and responsive browser behavior still require an approved deployed staging target. They are not verified by Phase 7B.1.
