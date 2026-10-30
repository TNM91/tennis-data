# Native tournament entry

My Lab → Your competitions → Browse tournaments → open a division → Entry and registration.

Signed-in members can request singles entry or enter with a doubles partner. Linked player names are fixed to the account; other names and both levels are explicitly self-reported. The member confirms division eligibility and their partner's permission. Requests remain pending until the organizer approves them. Members see only their own account-linked receipt and the organizer's player-visible decision note. Existing anonymous website requests are not claimed by matching a name or email.

Organizers open **Review app entries**, check the players' eligibility, and approve or decline with a note to the player. Approval adds the entrant through the existing event registration desk in the same transaction, or updates a standalone draw. It never records a payment. Configured event fees are copied to the desk with zero paid. Self-rated levels retain the self evidence source even when the organizer confirms eligibility. This does not establish a USTA rating or verify a player identity.

The queue is explicitly limited to app requests, 50 at a time plus a more-results sentinel. It does not pretend to replace the complete website registration desk. Changes to an approved/declined entry, waitlisting, withdrawals, fee collection, full event creation, and result editing remain organizer follow-up work.

## Boundaries and consistency

GET/POST /api/mobile/tournaments/entry verifies the bearer session and uses only its caller-JWT Supabase client. The new authenticated-only native_tournament_registration capability derives ownership from auth.uid(); no owner override is accepted. Its two SECURITY DEFINER helpers are not callable by anonymous or authenticated API roles. No new table read/write grant or general entry RLS policy is added.

Both event and division must be public, non-draft and correctly related. Queue/decision actions require existing manager access to both. The published director-email path stays with the director. Registration closes after the event-local deadline (inclusive on the deadline day); completed events and draws with any results or assigned courts cannot accept a new field member. Unsupported draw formats cannot accept an app entry. An organizer can review an already-received request after the deadline while the field remains unlocked.

One account has one create-only request per division. A locked parent/division serializes the ownership check and insertion; retries return the existing receipt before consuming another rate-limit allowance or notification. Approval/decline uses exact request timestamps and an actor/context revision, locks the same parent/division order as the existing desk, and permits only a still-pending app request. Approval invokes the existing duplicate-player and field-lock rules atomically. A failed desk write leaves the request pending. A stale or uncertain result requires a fresh status read before another mutation.

Requests allow at most eight new entries per account per hour across divisions. No email/phone is copied into the native request. Best-effort existing in-app notifications announce a fresh request to the creator and a decision to its exact submitting account; retries do not notify again. This batch adds no email, SMS or push delivery promise.

The phone rechecks the session before and after transport, binds responses to account/event/division, clears stale private views while refreshing, locks uncertain writes, ignores late responses, and closes child dialogs on parent disposal/backgrounding. Names, notes and long labels are escaped/wrapped. Device Back closes registration before changing the selected division.

## Production migration and deletion

20261030000100_native_tournament_registration.sql requires separate production approval before release. It adds one bounded private JSON object to the existing entries table and the three scoped functions. It reuses submitted_by_user_id and its existing ON DELETE SET NULL reference; no additional account identifier or ownership table is introduced.

The same transaction pins the existing account-erasure functions by normalized source fingerprints, updates the exact public-column catalog hash, and inserts reviewed cleanup at an exact marker. Unknown catalog/function changes abort the transaction. FK, trigger and private Apple-purchase guards remain in force. Requests from accounts awaiting deletion are blocked.

Deletion removes the account's pending/declined app entries and entry-rate-limit records. For an approved shared competition entry it clears native metadata, self-rating, eligibility rating/evidence source, private note and reviewer association; existing auth deletion detaches its account owner. The approved field/registration names, approval status, match results and shared competition history remain. Other accounts' requests are untouched. Existing shared-record retention remains part of the separate public-launch disclosure review.

## Verification

Focused tests exercise actual isolated PostgreSQL functions, account/manager boundaries, duplicate and stale writes, singles/doubles validation, fees without payment, registration locks/deadlines, rate limits, bounded queues and automated erasure with both LF/CRLF source. Route/transport tests cover bounded JSON bytes, private response projections, cache controls and account/selection binding.

The existing tournament phone suite now also covers entry receipts, partner attestations, organizer confirmation, lost replies, closed/director registrations, device Back, disposal and long names at 320/390 px on Chromium and WebKit using the packaged styles. Full repository verification and required GitHub CI still gate release. Test data stays isolated; no real member request, notification, draw or payment is written for QA. A physical TestFlight check remains necessary after the approved migration and signed build.
