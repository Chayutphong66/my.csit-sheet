# Production enhancement activation

The account, profile, follow, feed, privacy, avatar, notification preference, and admin profile-change features are code-complete but are not automatically deployed.

## Database

Run `npm run db:migrate` against the production PostgreSQL connection during a controlled release. Migration `003_account_community_enhancements.sql` is additive: it does not delete or rewrite documents, uploads, versions, users, or storage objects. Take a Supabase backup first. Rollback should be performed from that backup; dropping the new tables/columns is intentionally not automated because it would discard newly created account-security history.

## Gmail SMTP activation

Configure these Railway variables without committing credentials: `APP_BASE_URL`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=comintsheet.csit@gmail.com`, `SMTP_PASS` (a Gmail App Password), and `MAIL_FROM=CSIT Sheet <comintsheet.csit@gmail.com>`. Keep `EMAIL_VERIFICATION_ENFORCED=false` initially.

Deploy, request verification and password-reset messages for a controlled test account, verify their links and sender, then set `EMAIL_VERIFICATION_ENFORCED=true`. Production startup fails closed if enforcement is enabled without complete SMTP configuration. Development and tests use the mock delivery provider; production without SMTP records `UNAVAILABLE` and never claims delivery.

## Administrator identity

`abubogal.bob555@gmail.com` is the requested administrator email, but code and migrations do not create, promote, replace, or edit an administrator. An authorized owner must authenticate the existing administrator, verify control of the new mailbox, and perform a separately audited identity update. Password recovery already uses the same secure flow for users and administrators.

## Post-deployment checks

1. Confirm `/api/health` and schema readiness.
2. Confirm existing login, documents, uploads, approvals, versions, search, stars, and notifications.
3. Test verification, resend throttling, forgot/reset, session invalidation, and an administrator reset.
4. Test avatar upload/remove with PNG, JPEG, WebP, invalid content, and files over 1 MB.
5. Test follow/unfollow, privacy, follower lists, and following-feed filtering.
6. Submit and concurrently review program/cohort changes; verify only one decision succeeds.
7. Check desktop, tablet, and mobile settings/profile/home layouts.
8. Review `email_deliveries` statuses without logging tokens or SMTP credentials.
