# Native Team Room milestone

## Implemented

My teams adds linked-team selection plus Match day, Conversation, and Members views. It reuses the existing bearer-authenticated `/api/team-rooms` API and its accepted-team membership and removed-member checks. The client captures the current account ID, requires the current session to match, pins HTTPS origin/path, disables redirects, and uses 12-second connection/read timeouts. A returned room must match an explicitly selected team/league/flight. No tokens appear in URLs, logs, screenshots, source, or persistent feature caches.

The API's existing GET can ensure the room, synchronize accepted participants, and mark its conversation read. Native verification uses synthetic responses; no live team was opened or message sent. The app adds no POST actions, invitations, reactions, availability replies, reminder changes, notification registrations, or attachment fetches.

Match day shows the recorded next scheduled match and the active shared court plan with its active/upcoming/archived state. It does not label a draft/shared plan as a final published lineup. Conversation shows up to 75 messages from the loaded bounded window in chronological bubbles, with sender/time, announcement/reply context, and removed-message placeholders. Attachment URLs are never rendered or opened. The active card is retained from the server window even when outside the 75 conversation messages. Members shows up to 100 accepted connected members and team roles; it does not expose emails, invitation tokens, or management actions.

## Shared history correction

The existing room GET previously selected the oldest 300 messages. `loadTeamConversationMessages` now selects the newest 300 by descending timestamp/ID, then reverses a copy for chronological delivery. Conversation ID filtering and the 300-row bound stay intact. The correction also benefits the website and avoids hiding current discussion in established rooms. It does not add an unbounded history scan, new infrastructure, polling, or grants. Older active cards outside that server window remain unavailable.

## Lifecycle and boundaries

Team changes immediately clear the previous room, reset to Match day, and discard superseded responses. Screen/account revisions prevent late results from displaying after navigation or sign-out. Same-account token refresh and foreground preserve the active view. Refresh is explicit; no automatic polling or cross-account cache is added. Empty team membership, unavailable/forbidden responses, malformed payloads, and scope mismatches fail closed and offer a retry.

## Next connected work

This milestone supports team review. Message composition, replies/reactions, reporting/blocking/moderation, attachment handling, native push, availability replies, lineup acknowledgment, and captain publishing remain future work. Do not display inactive controls implying those actions work. New conversation sending must ship with the required reporting/blocking and membership behavior, not a disconnected message system. Live test sends and invitations still require explicit authorization.

## Verification

Focused tests cover exact-owner sessions, fixed scoped transport, stale-screen checks, mismatched rooms, malformed/no-team responses, removed text/attachment URL handling, active-card retention, and newest bounded chronological history. Synthetic phone checks exercise linked-team switching, Match day, Conversation, Members, and no horizontal overflow. These do not establish actual team access or iPhone native-transport acceptance; TestFlight remains the real-device acceptance lane.

## Chat sending preparation (not released)

The server send action now accepts an optional UUID v4 `clientMessageId`. A native composer must generate it once per send, retain it and the exact payload through uncertain responses, and retry that same send rather than generating another ID. The existing message primary key arbitrates simultaneous insert attempts; no migration is needed. After current membership and reply validation, a duplicate can return only the same sender's message in the same conversation with matching text, message kind and reply. Edited/deleted/conflicting rows fail closed. Legacy website sends without the key retain their existing behavior.

A replay exits before conversation updates and notifications, preventing duplicate notification attempts. This is not guaranteed notification delivery: if the first request saves the post and fails before notifying, a retry confirms the post without retrying notification delivery. No automatic retry, polling, live send, notification registration, or new access grant is introduced.

This preparation does not enable the native composer. Reporting, blocking, a usable moderation path, scoped in-memory draft/send lifecycle, and synthetic end-to-end composer checks still need to be delivered together before native posting is released. Build 11 remains the current internal beta.
