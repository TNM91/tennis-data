# Complete Coach app integration

The app owns the Coach experience. Coach tools open inside the installed app and use the existing website's data, tennis rules, templates and shared engines. An external browser is not an implementation of a Coach feature. Calendar subscriptions may hand off to the device's Calendar app, and explicit exports may use the native share sheet.

## Feature coverage for this integration

| Area | Existing baseline | App integration |
| --- | --- | --- |
| Students | `coach-storage`, existing Coach tables | Roster, development identity, contact preferences, pause/resume, invitations and student detail |
| Assignments | `coach-storage`, `coach-assignment-templates` | Create, edit, publish, archive, review and retain player proof |
| Lesson planning | `coach-workspace`, `player-development` | Session presets, identity lesson blocks, lesson date/site/focus and follow-up |
| Practice packs | Coach page handoff helpers, Level Up catalog | Assign existing cards/packs, retain card completion and recorded proof |
| Shared weeks | `weekly-plan`, existing guarded response function | Read shared plans, acknowledge, add cues, swap open reps and answer questions |
| Calendar | `coach-calendar`, existing scoped calendar feeds | Agenda, lessons and due dates, calendar export/subscription management |
| Communication | Existing direct messaging | Contact a connected student inside the app; system sharing remains explicit |
| Video | `video-review` engine and annotation UI | Account-scoped real clips, capture/import, playback, annotations, package import/export and feedback |
| Tactics | Shared `TiqTacticalStudio` and tactical helpers | Dedicated full-screen court, touch editing, formations, paths, zones, undo, inspector, timeline, presentation, briefs, device/account libraries and native exports |

The Coach hub opens these tools inside the app. The Advanced Coach website action has been removed. Release gates cover both phone browser engines, private API boundaries, interrupted saves and native file export; the iOS bridge requires fresh simulator evidence for this batch.

## Platform boundaries

The shared tactical engine receives app ports for navigation, account-scoped device storage, authenticated library saves, clipboard, sharing and file exports. Native builds replace Next image/link runtime adapters with bundled images and app navigation; the website keeps its normal runtime. Supplied artwork comes only from `public/brand/` and is packaged without transformation.

Native tactical account updates and deletes check the exact owned record revision. Interrupted saves require an explicit read before retrying the same change. A library refresh cannot silently authorize an older open board to overwrite a newer account version. Device content uses owner-scoped records, and account changes dispose open editors and ignore late responses.

No new database grants, credentials, paid tiers or public App Store submission are part of this integration. New native file-export code requires a fresh simulator runtime proof before a signed beta release. Physical camera/share behavior must be distinguished from simulated verification.

## Device behavior and limits

- Tactics opens as a full-screen workspace with Court, Tools, Details, Saved and Brief. Players drag on the court; paths support dragging or two endpoint taps. Shared formations, inspector, timeline, presentation, JSON, PNG and role briefs retain the existing engine.
- Lesson planning reuses all existing session presets, identity lessons, templates, assignable Level Up cards and practice packs. Published lesson dates and assignment deadlines feed the same existing student calendar. Creating/replacing a subscription is explicit, discloses link access and stops the previous token. No raw subscription token is written to device storage. Native feed links omit website actions inside calendar events.
- Shared-week responses use the existing guarded database function. Its row lock preserves current player progress; the app additionally checks the displayed plan revision before sending. A missing response requires a refresh and explicit review before another update.
- Coach/player messages use the existing private conversation, participant and message tables under the signed-in user’s RLS. Only an active connected coach or player can access the selected conversation through this API. Message IDs make interrupted sends recoverable without duplicate messages. This view refreshes on request.
- Video clips use the shared playback, annotation and review-file engine. The app uses real roster targets, stores clips in account-specific IndexedDB databases, and saves video bytes in chunks. These device clips are not automatically uploaded or delivered by changing a review status. Sending a review file is an explicit share action; receiving it uses import. Recordings and pending camera requests stop when their view closes or the account changes. Camera recording still needs physical-iPhone testing.
- Native file sharing writes bounded chunks to private temporary files and cleans up on completion, cancellation or timeout. Exports accept fixed data formats and filenames, never a remote URL or supplied filesystem path. The simulator probe verifies owner/request/offset validation, single-export exclusion, cancellation and bridge recovery alongside the existing StoreKit and Face ID checks. It does not prove delivery to a particular third-party app.
- A confirmed account-deletion request clears that account’s Coach device cache. Ordinary logout retains device drafts for the same account; other accounts cannot open them.
- Browser fixtures use synthetic accounts and a supplied public product-tour clip as review-file bytes. This Windows Chromium host cancels even a plain-text Blob download control; WebKit and Linux CI verify downloaded bytes, while the Windows Chromium test verifies the generated review package. Installed iOS exports are verified separately through the native bridge.

## Coach conversations in Chats

Chats includes a separate **Coach & player** list for the signed-in account’s current connections. Search by name, then open the exact private conversation without leaving the app. The existing Coach messages entry point remains available. Team search and All/Unread filters retain their values when a private conversation closes; coach connections have a separate search and are not included in team unread counts.

The list uses one bounded read of the existing authenticated, RLS-backed `/api/mobile/coach/messages` service on first opening Chats, with an explicit Refresh action and no background polling, message prefetch, new database permissions or notification changes. The client rejects mismatched owners, duplicate or invalid connection identifiers, invalid roles, oversized responses and late responses after account changes. The list still loads when the team directory fails. Service failure is shown as unavailable rather than an empty conversation list.

Opening a conversation freshly rechecks the current connection list and the selected conversation’s access. A removed target does not silently open another player’s messages. Existing draft-leave confirmation, stable message IDs and read-before-retry recovery apply. Back delegates to the private conversation; closing returns focus to its source row. Navigation/account changes dispose the owned view and clear its in-memory messages, pending sends and search. Physical iPhone/VoiceOver and keyboard acceptance remain separate from synthetic browser verification.

## Private-conversation unread badges

Chats shows unread badges and separate All/Unread filters for Coach & player conversations. The bottom Chats badge combines verified team and coach message counts, capped at 99+. Team filters and totals retain their existing meaning. The API keeps its original team `total` field for older installed builds and adds a separately validated `coach` projection. A coach-count outage preserves team badges and announces that some counts are unavailable; an unknown private count is never presented as caught up.

Counts refresh when Chats opens, the app resumes/reconnects, Refresh conversations is selected, or a displayed private message is acknowledged. Coach messaging still refreshes on request. This update does not add live coach-message signals, push delivery or an app-icon badge. The existing team signal subscription and team push settings continue to serve team rooms.

The server uses the signed-in account’s RLS client for two bounded reads: at most 100 active, linked coach/player connections, then their exact deterministic direct conversations with that owner’s participant row and the latest 100 eligible posts per conversation. Embedded per-parent limits follow [PostgREST resource embedding](https://docs.postgrest.org/en/v13/references/api/resource_embedding.html#embedded-filters). Queries select identifiers and timestamps, never message bodies, names or contacts, and share an eight-second deadline with automatic retries disabled. Closed, uninitialized or inaccessible conversations contribute no accessible unread posts. Invalid, duplicate, oversized or mismatched data makes coach counts unavailable. There is no query per connection, timer polling or new database permission. One content-free warning per failed count/checkpoint request retains a useful failure signal.

A private view advances its read checkpoint only after the end of the latest loaded message is visible in the foreground. Scrolling, view visibility and the existing native App state are checked; a hidden or disposed view cannot initiate an acknowledgement. The PATCH accepts only the selected connection and a rendered message UUID. Current coach linkage and exact conversation participation are checked again under RLS. The shared existing checkpoint writer looks up that message in the same conversation, uses its database timestamp, and advances only the current participant’s older checkpoint; mute and role fields stay untouched. Shared timestamp comparison preserves Postgres microseconds. A later message remains unread. An unconfirmed update keeps the badge and offers an explicit refresh rather than an automatic retry. This read action creates no message, conversation, participant or notification.

Phone fixtures cover 320/390 px with larger text, filtering/focus, unavailable counts, invisible/background messages, interrupted acknowledgements, newer messages and late old-account replies. Read-only production verification includes an empty authenticated embedding probe; it sends no real coach message and changes no member’s read position. Physical iPhone/VoiceOver acceptance remains separate.
