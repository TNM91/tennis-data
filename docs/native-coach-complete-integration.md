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
