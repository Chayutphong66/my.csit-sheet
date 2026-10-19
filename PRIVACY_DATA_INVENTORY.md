# Privacy data inventory (owner-review draft)

Verified against the application source on 2026-10-19. This is an engineering inventory, not approved legal text.

| Data/process | Verified purpose | Storage/recipient | User control | Retention status |
| --- | --- | --- | --- | --- |
| Account identity, email, password hash, program/cohort | Account access and community identity | Application database | Profile settings; account deactivation exists | No complete deletion schedule verified |
| Access/refresh tokens | Authenticated sessions | Access token in browser memory; hashed refresh-token record in DB; HTTP-only cookie | Logout/revocation | Expiry and revocation implemented |
| Uploaded files and document metadata | Review, publication, viewing and download | Database and configured local/object storage | Upload/review workflows | No global deletion schedule verified |
| Views, downloads, stars, helpful votes, follows | Product/community functions | Application database | Some actions reversible in UI | No retention schedule verified |
| Notifications and email delivery status | Activity notifications | Database; configured SMTP provider receives recipient data when enabled | Notification preferences | Provider and retention need deployment-owner confirmation |
| Feedback reports and review history | Support and product improvement | Application database; admin-only notes are not returned to reporters | Authenticated reporter can view own history | No deletion workflow yet |
| Privacy notice acknowledgement | Avoid repeating the informational notice | Browser localStorage only (`version`, `acknowledgedAt`) | Clear browser storage | Until cleared or notice version changes |

The proposed notice version is `2026-10-19.1`. Acknowledgement records that the informational notice was seen; it is not implemented or described as legal consent.

No analytics, advertising tracker, or optional tracking consent flow was found in the reviewed frontend. This statement must be re-audited when third-party scripts are added.

## BLOCKED owner/legal decisions

- Controller identity and privacy contact.
- Legal basis and applicable jurisdiction for each purpose.
- Retention/deletion periods and data-subject request workflow.
- Confirmed processors/subprocessors, locations, transfer mechanisms, and contracts.
- Approved effective date, policy owner, revision process, and final wording.
