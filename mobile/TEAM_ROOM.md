# Native team chat milestone

## Candidate behavior

My teams opens Conversation first, alongside Match day and Members. It reuses the existing accepted-team membership and removed-member checks. The navy conversation has a bounded scrollable history, reply previews, captain announcement labels, and a composer. Text and reply context stay in memory while switching the team's tabs or refreshing. Team changes and disposal clear drafts; no private draft enters local storage. Incoming updates still require explicit Refresh; this candidate adds no polling or background connection.

Text posts and replies use the fixed HTTPS Team Room endpoint through CapacitorHttp with the current owner's bearer session, disabled redirects, and 12-second connection/read timeouts. A native send receives one UUID v4. Uncertain responses lock its payload and offer retry with the same ID; simultaneous taps do not create another send. Success must confirm the exact ID, own-message flag, and text before clearing the draft. A retry after an uncertain response preserves the pending ID even if authentication subsequently fails. Discard retry explicitly warns that the original post may already exist. Navigation/sign-out clears transient state and suppresses late results; a user manually retyping a discarded post is outside automatic retry protection.

The server's existing primary key arbitrates concurrent sends. Duplicate responses require matching conversation, sender, text, kind and reply; edited/deleted/conflicting posts fail closed. Replays do not repeat notifications. This guarantees at most one inserted message per retained ID, not guaranteed notification delivery if the first request saves then fails before notifying. Website sends without an ID retain their legacy send semantics.

## Connected safety

The candidate includes private reports with four reasons, per-account blocking/unblocking of chat posts, and an Admin review queue at `/admin/team-chat`. Current membership is checked before reporting or changing block settings. Report content and author are derived from the selected room's stored message, not supplied by the client. Duplicate reports from the same reporter for the same post do not overwrite the existing review record. Only verified existing admins can load the bounded queue or resolve/remove a reported post. Removal is a soft deletion scoped to the report's stored message, room and author; the reviewer and time are recorded.

Blocked message text, reply targets and attachment/card metadata are redacted before the room payload is assembled, including website room reads. Ordinary chat notifications from that sender are suppressed for the blocker. Blocking does not remove either member from the team or prevent the group from seeing the blocker's posts; match workflow notifications outside ordinary chat may still arrive. Existing historical notification records are not retroactively removed. There are no claims of direct messaging, complete notification erasure, automated content filtering, or push delivery in this candidate.

## Database activation and release

`supabase/migrations/20261024000100_team_chat_moderation.sql` was applied to the TenAceIQ project on October 24, 2026 UTC before deploying the dependent code. It creates two private RLS-enabled tables and resets default grants before explicitly granting only the required service-role operations. Anon/authenticated roles have no direct table privileges; the server cannot delete report records. The transaction is safe to reapply through the migration lane.

All eight catalog permission/RLS checks passed. Actual Data API checks returned service-role reads 200, anon reads 401 and authenticated QA reads 403. Service-role inserts with nonexistent random foreign keys returned the expected 23503 constraint failures (no records stored); updates/deletes scoped to nonexistent random IDs confirmed the required grants without changing rows. Report deletion was denied with 403. No chat message, real report, or live block was created by these checks.

The APIs fail closed when moderation storage is unavailable. Release requires full checks and required CI, then one normal Git production deployment and a signed internal TestFlight build under standing beta approval. Live test posts and invitations remain unauthorized; composer and moderation workflow checks use synthetic fixtures.

## Verification and limits

Focused tests cover send IDs and racing retries, payload/owner/session checks, uncertain responses, late/disposed state, private report author/scope derivation, block redaction, notification suppression, admin-only queue access, and report-scoped post removal. The actual mobile entry is exercised at phone width with synthetic auth/data and all external requests blocked: draft retention between views, one stored post across a simulated failed response and retry, report save, block redaction, unblock and no horizontal overflow.

Real iPhone keyboard/transport acceptance and moderator use with actual reports remain beta acceptance checks; local and role verification do not establish those device/user flows. Push notifications, live delivery/unread markers, reactions, photos/files, availability replies, lineup acknowledgment and captain publishing remain connected follow-up work. Build 11 remains the released internal beta until this candidate's database and release checks are complete.
