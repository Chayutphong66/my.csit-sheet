# R1 Nodemailer temporary risk acceptance

Status: **CONDITIONALLY ACCEPTED — RELEASE CONDITIONS PENDING**

Assessment date: 2026-10-19

Proposed expiration: 2026-11-18 (30 calendar days)

Package: `nodemailer@7.0.13`

Audit result: one aggregate High production finding

Minimum version reported by `npm audit` to resolve the aggregate: `10.1.7` (SemVer major)

Decision: **CONDITIONALLY ACCEPTED**

Approval source: explicit Owner decision in ChatGPT

Approval date: 2026-10-19

Scope: R1 only

Residual severity: High

Remediation owner: **PENDING IDENTIFICATION**

This record documents the Owner's conditional risk decision; it is not a formal signature and does not authorize a Production release. It is valid only if the compensating-control changes and tests identified below are reviewed, committed, pass fresh CI, and are deployed together with R1. Expiration is automatic; silence does not extend acceptance.

## Scope and evidence

- Lockfile evidence: `package-lock.json` resolves Nodemailer 7.0.13 with an integrity hash.
- Audit evidence: local `npm audit --omit=dev --json` on 2026-10-19 returned the 13 advisories below and one aggregate High finding.
- Code reviewed: `backend/src/services/email.service.js`, all `sendEmail` call sites, authentication/admin/contributor/community routes, validation, rate limiting, templates, configuration and safe logging.
- Tests: `backend/test/email-security.test.js` plus the existing auth, account/community, infrastructure and safe-logger suites.
- No Production SMTP connection or real email delivery was attempted. Current Production SMTP settings and provider behavior were not verified.

## Advisory and reachability matrix

“Fixed” is the first version outside the audit range, while 10.1.7 is the aggregate remediation target reported by npm.

| Advisory | Severity | Audit range / first fixed | Exploit precondition and application reachability | Control and residual exposure |
|---|---:|---|---|---|
| [GHSA-c7w3-x93f-qmm8](https://github.com/advisories/GHSA-c7w3-x93f-qmm8) | Low | `<8.0.4` / 8.0.4 | Attacker must control `envelope.size`. CSIT Sheet never passes an `envelope` object. | Closed message shape prevents this option. Residual: future code could reintroduce it unless tests remain enforced. |
| [GHSA-vvjj-xcjg-gr5g](https://github.com/advisories/GHSA-vvjj-xcjg-gr5g) | Moderate | `<=8.0.4` / 8.0.5 | CRLF control of transport `name`/EHLO. CSIT Sheet does not set `name`; SMTP host is operator configuration. | SMTP host rejects CR/LF. Residual is configuration drift or an unreviewed new transport option. |
| [GHSA-268h-hp4c-crq3](https://github.com/advisories/GHSA-268h-hp4c-crq3) | Moderate | `<=8.0.8` / 8.0.9 | Attacker must control List-* header comments. No custom/List headers are accepted. | Message keys are restricted to from/to/subject/html/text; header values reject CR/LF. Future header expansion remains a risk. |
| [GHSA-wqvq-jvpq-h66f](https://github.com/advisories/GHSA-wqvq-jvpq-h66f) | Moderate | `<=8.0.8` / 8.0.9 | Requires `jsonTransport` and file/URL content. Application uses SMTP only. | `disableFileAccess` and `disableUrlAccess` are set; no content objects are passed. Raw/json paths in the vulnerable library still exist but are not invoked. |
| [GHSA-p6gq-j5cr-w38f](https://github.com/advisories/GHSA-p6gq-j5cr-w38f) | High | `<=9.0.0` / 9.0.1 | Requires message-level `raw`, enabling file read/SSRF despite disable flags. | Input destructuring and closed message construction discard `raw`, attachments and arbitrary options. Residual is severe if the closed shape is later bypassed. |
| [GHSA-8m3c-c648-2xjj](https://github.com/advisories/GHSA-8m3c-c648-2xjj) | Moderate | `<=9.1.0` / 9.1.1 | Requires direct legacy `resolveContent()` use with attacker-controlled content. No application call exists. | No reachable call path found. Static review cannot prove a future dependency-internal path is impossible. |
| [GHSA-wmmp-3585-3rmp](https://github.com/advisories/GHSA-wmmp-3585-3rmp) | Moderate | `<9.1.0` / 9.1.0 | Exploits IDN/Punycode allow-list comparison. Application has no recipient-domain allow-list. | Recipient is a single conservatively validated mailbox. No allow-list security decision is made. Risk would become reachable if domain allow-listing is added incorrectly. |
| [GHSA-2x7j-588g-ccc2](https://github.com/advisories/GHSA-2x7j-588g-ccc2) | High | `<9.1.0` / 9.1.0 | Crafted address list causes quadratic parsing. An attacker needs a complex/long recipient value to reach Nodemailer. | Single mailbox only, max 255 bytes, no arrays/objects/lists/comments/quoted mailbox syntax. Residual parser work remains for a bounded address. |
| [GHSA-cc9r-2j5m-2m83](https://github.com/advisories/GHSA-cc9r-2j5m-2m83) | Moderate | `>=6.9.16 <9.1.0` / 9.1.0 | RFC 5322 comment parsing can bypass a recipient-domain allow-list. No allow-list is used. | Comments and multi-recipient syntax are rejected before transport creation. Residual only if the mailbox validator or delivery policy changes. |
| [GHSA-6vj9-mwq6-2f5v](https://github.com/advisories/GHSA-6vj9-mwq6-2f5v) | Moderate | `>=5.0.0 <10.0.2` / 10.0.2 | Multiple transports to different SMTP tenants can reuse a process-global DNS/TLS server name. | Application caches one operator-configured transport. Residual exists if SMTP configuration changes without process restart or multi-tenant transports are introduced. Live provider behavior is unverified. |
| [GHSA-8vvx-rff5-p5rq](https://github.com/advisories/GHSA-8vvx-rff5-p5rq) | Moderate | `<10.0.2` / 10.0.2 | Deep nested structured recipient arrays exhaust the stack. | Arrays/objects are rejected and only a scalar mailbox enters Nodemailer. Residual depends on retaining the boundary validation. |
| [GHSA-v53p-9fqp-m79j](https://github.com/advisories/GHSA-v53p-9fqp-m79j) | High | `<=10.0.5` / 10.0.6 | Crafted free-text address triggers quadratic backtracking. | Strict 255-byte single-mailbox syntax rejects comments, quoted names and lists. Some bounded parser exposure remains; library is still vulnerable. |
| [GHSA-r7g4-qg5f-qqm2](https://github.com/advisories/GHSA-r7g4-qg5f-qqm2) | High | `<=8.0.7` / 8.0.8 | Requires Nodemailer OAuth2 token retrieval and a network attacker/TLS validation weakness. | CSIT Sheet uses SMTP username/password, not OAuth2. `secure:true` uses implicit TLS; `secure:false` now sets `requireTLS:true`. Provider certificate behavior was not live-tested. |

Advisory data is time-sensitive. A fresh audit is required immediately before approval and deployment.

## Verified email attack surface

### Delivery boundary

- The application constructs only `from`, `to`, `subject`, `html` and `text`.
- `raw`, `attachments`, `envelope`, custom headers, file paths, URLs and structured recipients are not accepted.
- Recipient values must be one ASCII mailbox of at most 255 characters. CR/LF, lists, display names, comments, quoted mailbox syntax, arrays and objects fail closed.
- Sender and subject reject CR/LF. The sender remains operator-configured and cannot be set by a request.
- File and URL content access are disabled at transport construction.
- Port 465/`secure:true` uses implicit TLS. Other ports require STARTTLS through `requireTLS:true`, preventing plaintext downgrade.
- SMTP host/user/password and sender are configuration, not request fields. Credentials are never included in structured error metadata.

### Call sites and authorization

| Trigger | Recipient source | Access/control |
|---|---|---|
| Registration/resend verification | Persisted validated account email | Public endpoint, generic response where applicable, IP auth limiter; single-use token |
| Forgot/reset password | Persisted account email | Public request is IP rate-limited and enumeration-safe; reset token is single-use |
| Password/display-name change | Authenticated user's persisted email | Authentication/ownership required |
| Profile-change decision | Request owner's persisted email | ADMIN route/RBAC required |
| Followed-document notification | Opted-in follower's persisted email | User preference plus six-hour per-user/template suppression |

Template variables are HTML-escaped. Subjects are selected from a fixed template set. Unknown templates fail and are recorded as failed delivery. Delivery errors are logged through the safe logger and callers receive status rather than SMTP secrets.

## Required compensating controls

1. Ship the reviewed `email.service.js` closed-message and transport controls unchanged.
2. Keep `email-security.test.js` in mandatory backend CI.
3. Do not add raw messages, attachments, content paths/URLs, custom headers, recipient lists, OAuth2, per-tenant transports or recipient-domain allow-listing during the acceptance window.
4. Keep SMTP credentials server-only; rotate immediately on suspected disclosure.
5. Monitor email delivery failure rate, authentication rate-limit responses and unusual recipient-validation failures without logging message bodies or credentials.
6. Re-run production `npm audit --omit=dev` immediately before release and at least weekly during the acceptance window.
7. Upgrade to a non-vulnerable supported Nodemailer release no later than 2026-11-18, with compatibility tests against an isolated SMTP test double/provider sandbox.

## Mandatory release gates

| Gate | Current state |
|---|---|
| Reviewed email controls and focused tests included in final SHA | Local changes present; commit authorization not granted |
| Fresh Standard CI on final SHA | Pending |
| Fresh PostgreSQL 16 CI with zero PostgreSQL skips | Pending |
| Production SMTP/TLS configuration evidence | Pending Production verification |
| No raw/attachment/file/URL/structured-recipient/OAuth2/multi-tenant transport expansion | Verified locally; must remain true through release |
| Named remediation owner | Pending identification |
| Nodemailer remediation by 2026-11-18 | Pending |
| Reassessment on a newly applicable Critical vulnerability or exploit | Required throughout acceptance window |

Failure of any mandatory gate means this decision does not authorize release.

## Remaining risks and uncertainty

- Vulnerable code remains installed; controls reduce reachable inputs rather than removing the defects.
- No real SMTP/TLS handshake or Production provider configuration was tested.
- In-memory IP rate limiting is per process and not a distributed/global abuse control.
- Persisted legacy email rows were not audited in Production. The delivery boundary now rejects unsafe formats, but this can cause non-delivery.
- A future call site or dependency change could accidentally expand the message/transport surface.
- Provider-side throttling, TLS policy, DNS behavior, credential scope and alerting remain unverified.

## Remediation plan

Owner: to be assigned

Target: upgrade Nodemailer to at least the aggregate fixed version reported by a fresh audit (currently 10.1.7) by 2026-11-18.

Required steps:

1. Review Nodemailer 8–10 breaking changes and Node 22 compatibility.
2. Upgrade on an isolated branch without `npm audit fix --force`.
3. Retain the application-layer recipient/message restrictions and transport controls.
4. Run focused SMTP mock tests, full backend/frontend regression, lint, build and both dependency audits.
5. Exercise an isolated SMTP sandbox with implicit TLS and STARTTLS configurations; never use Production recipients.
6. Obtain fresh Standard CI evidence before deployment.

## Recommendation

**CONDITIONALLY ACCEPTED BY OWNER**, with release conditions still pending.

The reviewed R1 code does not expose the highest-risk Nodemailer options, and the proposed local controls materially constrain recipient parsing, message shape, file/URL access and TLS downgrade. The Owner has accepted the documented residual risk for R1 through 2026-11-18, conditional on every mandatory release gate above. This decision does not verify those conditions and does not authorize deployment.

If these controls are not included, SMTP configuration cannot be confirmed to use TLS, or a new email path needs raw/attachments/structured recipients/multiple transports, the recommendation becomes **NOT ACCEPTABLE — REMEDIATION REQUIRED**.

## Decision record

- Approval source: explicit Owner decision in ChatGPT
- Approval date: 2026-10-19
- Decision: `CONDITIONALLY ACCEPTED`
- Scope: R1 only; final release SHA pending
- Expiration: 2026-11-18
- Required remediation owner: **PENDING IDENTIFICATION**
- Formal signed approval: not provided; confirm separately if repository or organization policy requires one

Security reviewer: _______________________________

Release manager: _________________________________

This decision records risk acceptance only. Verification of acceptance conditions and Production deployment authorization remain separate and pending. No Production release authorization has been granted.

## Legacy mailbox compatibility

New registrations and all outbound delivery paths use the same conservative ASCII dot-atom mailbox policy. Existing rows with non-ASCII, quoted, comment-bearing, list-shaped or otherwise unsupported mailbox syntax are not modified or deleted. Username/password login remains available, but email verification, resend, password-recovery and notification delivery cannot succeed until the address is changed to a supported mailbox through an authorized account-remediation process. Delivery attempts fail closed and retain a generic failed audit record without reflecting the unsafe value. Owner review of existing Production mailbox formats is required before release; this local assessment did not access Production data.
