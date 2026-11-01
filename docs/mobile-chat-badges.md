# Native chat unread badges

The Chats tab and team/Coach inbox rows already show unread-message counts.
The installed native badge bridge writes the complete team + Coach total to
the iPhone icon after foreground reconciliation and clears it at zero.

This change adds the same absolute total to an eligible background Apple alert
using [`aps.badge`](https://developer.apple.com/documentation/usernotifications/generating-a-remote-notification).
It requires the server deployment and migration below; the existing installed
app can receive it without a new native build. A transport-only test alert does
not create a message or increment an unread count.

## Counting and delivery

- After current membership, mute, block and device eligibility checks, one
  `native_chat_badge_counts` RPC loads totals for up to 100 distinct recipients.
  Every enabled device for the same recipient receives the same snapshot.
- Team counts reuse `native_team_chat_rooms(..., 'list')`, including General,
  named rooms, accepted/current membership, blocks and per-room read positions.
  Muting stops alerts; it does not erase unread messages in the inbox.
- Coach counts match the foreground aggregate: current owner-linked
  connections, the deterministic direct conversation, the owner's participant
  and up to 100 latest undeleted posts from the other participant. Paused and
  inaccessible conversations contribute zero; inconsistent data stays unknown.
- The total is capped at 100, matching the installed native bridge. The
  in-app badge displays that cap as `99+`.
- A count of zero explicitly clears the icon badge. Missing, invalid, timed-out
  or failed counts omit `aps.badge`, preserving the current number while the
  ordinary alert continues. No increment counters or automatic retries exist.
- The aggregate has a two-second work budget between bounded operations;
  the server request has a 2.5-second deadline and no retry. Unfinished owners
  are omitted. Existing nested room locks retain their three-second lock limit.
  One recipient is not counted once per device or once per message banner.

Background counts are delivery snapshots. Out-of-order Apple delivery, reading
on another device or changing access without receiving another push can leave
an icon temporarily stale. The existing app reconciles from fresh counts on
return and after confirmed reads. This change adds no background polling,
new silent pushes, cron jobs, tables, stored badge totals or credentials.

## Migration and release

`20261101000100_native_chat_badge_counts.sql` adds one security-invoker function,
granted only to `service_role`; browser and anonymous execution are revoked.
It returns only recipient IDs and capped totals and changes no member records,
read positions or existing table grants. Production installation requires the
owner's separate permission approval. Apply and inspect its catalog grants
before deploying the new sender. The sender degrades to alerts without a badge
if the aggregate is unavailable.

The release candidate changes backend TypeScript, the migration, tests and this
document. It changes no app bundle, Swift, signing capability or artwork.

## Verification

Focused tests execute the migration in local PostgreSQL (PGlite), exercise
service/browser grants, compare team counts with the installed room aggregate,
and cover microsecond read positions, duplicate links, named rooms, blocks,
muting, removal, archived links, paused/closed/inaccessible Coach connections,
foreign senders, per-owner failure isolation and count limits. Transport tests
check distinct recipient badges, multiple devices, explicit zero, omitted
unknown counts and continuing alert delivery after an aggregate failure.

Device acceptance after release: receive a real controlled chat message while
the iPhone is locked, inspect the app icon before opening the alert, confirm
the Chats and room badges, read the latest message, then return to the Home
Screen and confirm the remaining total (or zero). The previous build-204
transport-only alert confirmed the lock-screen alert and correct General-room
tap; it did not test unread counts.
