# R1 local release change manifest

Prepared: 2026-10-19

Status: **LOCAL REVIEW PACKAGE — COMMIT AUTHORIZATION NOT GRANTED**

## Git baseline

- Worktree: `D:\my.csit-sheet-product`
- Branch: `feature/req02-08-09-product-improvements`
- Current committed HEAD: `188ef64158e56ae6b79e48f807bd68fa8162b2c8`
- Proposed release SHA: not available until a separately authorized commit is created
- Testing worktree remains at `cf98ffa65ddc3069b47455e8dbca9d81b9ba16a5` and must not be modified

## Exact proposed commit scope

The proposed scope contains exactly **16 files**: 11 modified files and 5 added files.

| File | State | Purpose |
|---|---|---|
| `PRIVACY_DATA_INVENTORY.md` | Modified | Align factual inventory, proposed notice version and acknowledgement semantics |
| `frontend/package.json` | Modified | Nonbreaking frontend vulnerability remediation |
| `frontend/src/components/PrivacyNotice.vue` | Modified | Concise factual notice; acknowledgement is explicitly not legal consent |
| `frontend/src/services/privacyNotice.js` | Modified | Proposed notice version `2026-10-19.1` |
| `frontend/src/views/PrivacyInformationView.vue` | Modified | Privacy P2 factual review-only content and owner/legal gaps |
| `frontend/test/privacy-notice.test.js` | Modified | Privacy wording, version, limitation and acknowledgement regression tests |
| `package-lock.json` | Modified | Reproducible dependency resolution for approved nonbreaking updates |
| `package.json` | Modified | Development/build dependency remediation |
| `backend/src/services/email.service.js` | Modified | Nodemailer compensating controls: mailbox/header checks, closed message shape, file/URL denial and TLS enforcement |
| `backend/src/services/emailAddress.service.js` | Added | Shared conservative mailbox policy used by account creation, recovery input and every delivery mode |
| `backend/src/middleware/validation.middleware.js` | Modified | Enforce the shared delivery-compatible mailbox policy at registration, resend and forgot-password boundaries |
| `backend/test/email-security.test.js` | Added | Shared mailbox and isolated SMTP/mock security tests; no real email delivery |
| `backend/test/account-community.test.js` | Modified | Registration, verification/resend, forgot/reset and safe validation regression coverage |
| `docs/release/R1_NODEMAILER_RISK_ACCEPTANCE.md` | Added | Conditional Owner risk decision, advisory evidence, controls, gates and remediation deadline |
| `docs/release/R1_OWNER_APPROVAL_PACKAGE.md` | Added | SMTP/TLS, Privacy P2 and Supabase backup evidence checklists |
| `docs/release/R1_RELEASE_CHANGE_MANIFEST.md` | Added | This exact local change manifest |

No migrations, Phase 7A/7B workflows, Phase 7C files or Production configuration are in scope.

## Dependency changes

| Package | Previous | Proposed |
|---|---:|---:|
| `axios` | 1.18.1 | 1.20.0 |
| `vue` | 3.5.18 | 3.5.44 |
| `proxy-addr` | 2.0.7 | 2.0.8 |
| `source-map-js` | 1.2.1 | 1.2.2 |
| `concurrently` | 9.2.4 | 9.2.5 |
| `shell-quote` | vulnerable 1.x resolution | 1.12.0 |
| `eslint-plugin-vue` | 10.4.0 | 10.6.0 |
| `postcss-selector-parser` | vulnerable transitive resolution | 7.1.6 |
| `brace-expansion` | vulnerable transitive resolutions | 1.1.21 / 2.1.7 |
| `nodemailer` | 7.0.13 | 7.0.13 — conditionally accepted through 2026-11-18 |

The lockfile may contain additional compatible transitive re-resolution. Review the exact lockfile diff before future commit authorization.

## Required future evidence

- Fresh Standard CI on the exact future commit SHA
- Fresh PostgreSQL 16 CI with migrations 001–007 and zero PostgreSQL skips
- Production SMTP/TLS checklist marked PASS
- Privacy P2 exact content approval and required owner/legal fields
- Supabase backup/PITR/isolated restore and Storage recovery evidence
- Named Nodemailer remediation owner
- Separate local commit authorization
- Separate feature-branch push authorization
- Separate pull-request creation/review authorization
- Separate merge-to-`main` authorization
- Separate Production deployment authorization; Railway tracks `main`, may auto-deploy a merged SHA, and its release command runs database migrations before application startup

None of the five actions above is authorized by this local review package.
