# Account deletion and database recovery

Automatic active-account deletion is implemented. A database restore is a separate, consequential operation; this document does not authorize one. Never run a restore, export customer data or enable a paid backup add-on as part of an ordinary beta release.

## Current evidence and limits

A read-only October 28 dashboard inspection showed daily physical database backups, with point-in-time recovery not enabled. Database backups include Storage metadata but not uploaded file contents. Exact account-specific snapshot dates and provider settings are kept in private release evidence. No backup settings were changed.

The public explanation distinguishes active-account cleanup from restricted backup retention. It does not promise that all backup copies expire within the active account's seven-day deletion window. Confirm current provider retention before public launch; recheck it if the plan or backup setup changes. The current provider documentation describes a seven-day accessible daily-backup window for Pro, but a documentation default is not a verified universal erasure deadline.

## Required procedure before restoring service

1. Obtain a reviewed, explicit restore plan and preserve the current minimal completed-deletion ledger independently of the snapshot being restored. Keep it in a private controlled destination; never commit it, publish it as CI output or store it with public artifacts. If the current ledger cannot be recovered, keep the restored service isolated and resolve that gap before exposure.
2. Restore only to the approved isolated destination. Disable public access, sign-in, jobs and outbound email/push/payment effects while checking it. A production restore can bring back old accounts, refresh sessions, queued messages and pending operations as well as application data.
3. Compare restored account IDs against completed `account_key_hash` values using the same SHA-256 representation as the deletion migration. Retain the original consent/audit history. Plan reviewed, exact-owner cleanup for each match; do not attempt broad deletion by email and do not mark a job complete without executing its checks.
4. Reapply the reviewed account freeze/session, billing ownership, Storage API, personal-data, Auth and residual-verification boundaries. Restored file metadata does not prove object bytes exist. Remove stale metadata only through the supported Storage service and investigate unsupported ownership or schema drift. Do not bypass catalog guards.
5. Reconcile current provider billing state; an old snapshot must not recreate a canceled subscription or grant expired access. Reconcile completed jobs and external idempotency receipts before enabling messages, notifications, email or payment processing. Avoid duplicate confirmation emails for requests already completed.
6. Verify absence of erased Auth/profile/session/private records and file remnants, current grants/schema, and unaffected shared team structures. Record only minimal content-free evidence. Resume service only after the reviewed recovery acceptance checks pass.

This is a runbook, not an implemented one-click restore scrubber or an exercised disaster-recovery test. Public-launch acceptance still needs an operator-owned recovery decision and a controlled isolated rehearsal; routine account deletion is automated and does not require daily manual account removal.

Reference: [Supabase database backups](https://supabase.com/docs/guides/platform/backups).
