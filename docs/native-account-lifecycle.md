# Native accounts and automatic deletion — build 150 candidate

Build 150 candidate. The approved production schema is installed with private tables, RLS, service-only functions and the reviewed shared-author references. Member activation is a separate gate after controlled provider verification. The runtime release evidence is kept with the candidate.

## Member experience

Email-code signup/sign-in accepts six- or eight-digit provider codes (the October 28 read-only provider check showed eight digits) and creates a Free account using the existing inactive paid-plan defaults. Account settings include recovery, existing web billing and permanent deletion. A deletion request requires a remotely verified email, password/OTP authentication within ten minutes, explicit consent to erasure and cancellation of existing TenAceIQ web billing, and typed DELETE. The service derives account/email from Auth. Retries return the original request; queued does not mean deleted.

The account is signed out as processing begins. Automatic cleanup finishes within seven days and sends completion email. Club owners must hand off ownership first, and the last platform administrator cannot be removed. Unsupported file ownership, schema changes or ambiguous billing stop processing rather than guessing. Apple subscriptions must be canceled in Apple subscription settings; this adds no native purchasing.

## Resumable worker

1. Check exact identity, the reviewed schema contract, ownership, billing mapping and supported Storage buckets.
2. Ban new sign-ins and revoke the exact owner's refresh sessions. Wait for outstanding JWT expiry plus two minutes. The October 28 read-only audit observed a 3,600-second expiry. Ban alone is not session revocation; do not change global Auth settings to accelerate testing.
3. Validate every Stripe subscription's customer and user_id metadata before cancellation. Never guess ownership by email. Cancel at most three subscriptions per pass without new proration; remove the uniquely mapped customer after handling its subscriptions. No refund or unrelated customer is touched.
4. Remove exact owned/path-matched objects through the Storage API, at most 100 per page. Requery the first page after removal. Unsupported buckets stop before freezing the account.
5. Remove authored messages/polls, private rows, linked practice contacts, verified-email contact copies, account-linked import payloads and cached quote/mention objects. Minimize raw financial audit payloads. Detach reviewed shared-author references so teammates retain rooms, conversations, schedules, groups and moderation exclusions.
6. Recheck schema/Storage before the provider hard-deletes Auth. Verify Auth/profile/session absence and residual keys/files.
7. Send the completion email with a stable provider idempotency key, then clear account/email/billing pointers. Keep only minimal request timestamps/reference and a pseudonymous account hash for recovery checks. Provider acceptance is not proof of personal inbox delivery.

Claims use a two-minute lease and random fencing token. A stale worker cannot advance SQL state. Error records contain fixed codes, not provider payloads, tokens or addresses. Backoff ranges from 15 minutes to six hours, capped at ten consecutive failures per phase. Three failures create one private administrator notification. Admins observe progress and investigate exceptions; the old manual certification POST is disabled.

## Database and schema guard

The first migration creates private request/rate-limit tables. The second adds opt-in automation state and service-only functions, replaces readiness/request/review behavior, and changes 17 shared-author references to nullable ON DELETE SET NULL. Existing client insert/update checks still require the acting author. No role or business ownership is automatically transferred.

The privileged worker derives destructive targets from a consented leased request, not caller IDs. Anonymous/authenticated access is revoked. Readiness checks all 1,981 audited public columns, account/profile FKs, and the exact two reviewed delete-signal triggers. Future schema changes require a fresh erasure review/contract update. Never bypass a mismatch.

The PostgreSQL fixture includes all audited public columns/types/nullability, 301 FKs and relevant signal triggers. It is not a complete restore of every production check, policy or function. It catches real-column errors and exercises shared-history/Storage/contact preservation.

## Configuration and cost

Activation requires ACCOUNT_ERASURE_ENABLED=true and the audited ACCOUNT_ERASURE_MAX_JWT_SECONDS value, plus existing service/mail/billing credentials. Set the activation flag only after the approved schema and controlled provider test are verified.

The proposed protected cron runs every 15 minutes: 96 empty queue reads/day, about 2,880/month. Idle runs do not contact Auth, Storage, Stripe or email. Each invocation processes one leased job, with a 40-second worker budget and 60-second route cap. An accepted request also starts one after-response attempt. Existing collectors/reminders are unchanged. No paid preview or infrastructure upgrade is required.

## Verification and release gates

Local tests use disposable synthetic accounts, PostgreSQL (with both LF and CRLF checkouts) and mocked provider calls. They cover owner isolation, reauthentication/consent, failed preflight, stale leases, refresh revocation, Storage isolation, private contact copies, quoted content, moderation preservation, cross-customer billing rejection and honest email failure.

Before activation: complete full repository/native verification and exact-head CI; review the two migrations and retention copy; apply/verify only reviewed SQL; confirm Auth expiry and private grants; run a dedicated temporary provider account through signup/deletion. Resend's labeled delivered@resend.dev recipients support delivery simulation without another inbox. Do not print OTPs/tokens. A signed-in test must wait for its actual token expiry. Simulation does not establish delivery to a human inbox. Free members retain the existing profile-upload restriction; provider cleanup fixtures are service-uploaded under only the disposable account's two reviewed path formats. Auth-owned object selection is also covered by the PostgreSQL fixture.

No existing member is a test target. Public submission, physical iPhone/accessibility acceptance, storefront/payment behavior and published retention/backup acceptance remain separate gates.

## Retained records and recovery

Independent public tennis history and shared organizational structures remain; the erased account's authored private content/contact copies are removed. Payment providers may retain required transaction records. The minimal request audit/hash is pseudonymous, not anonymous.

Before restoring backups, preserve the current deletion ledger separately, compare restored account IDs to completed hashes, and rerun removal before exposing restored data. Backup/archive expiry and recovery procedures must be documented before public launch. Normal automatic erasure does not require daily manual account cleanup.

References: [Apple deletion requirements](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion), [Supabase user removal/JWTs](https://supabase.com/docs/guides/auth/managing-user-data), [Storage removal](https://supabase.com/docs/reference/javascript/storage-from-remove), [Stripe cancellation](https://docs.stripe.com/api/subscriptions/cancel), [Resend test recipients](https://resend.com/docs/dashboard/emails/send-test-emails).
