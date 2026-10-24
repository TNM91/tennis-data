# TenAceIQ mobile readiness — 2026-10-23

## Decision

Evaluate Capacitor using an isolated local device harness before selecting a production mobile architecture. Keep the Next.js website and server APIs running as the web platform. Do not set the existing application to static export or submit a remote-website wrapper as the release candidate.

## Repository evidence

| Area | Observed | Required work |
| --- | --- | --- |
| Runtime | Next.js 16.3 / React 19; 131 files under `app/api`; request-dependent signup route; custom headers and image optimization in `next.config.ts` | Keep server execution hosted. Choose a bundled mobile client boundary and inventory the endpoints it uses. |
| Existing phone support | `app/manifest.ts` provides standalone metadata, brand icons, and tennis shortcuts | Reuse product scope and approved source artwork; verify actual device layout and navigation. PWA metadata does not create store packages. |
| Authentication | `lib/supabase.ts` persists sessions and detects URL sessions; password login in `app/login/page.tsx`; relative `/api/auth/access` in the auth provider | Prove lifecycle behavior, secure token storage, refresh/revocation, and bundled-client API origins. |
| Signup / recovery | Signup checks trusted request origins; confirmation email and password recovery return to web routes | Add and test verified app links and safe auth callbacks, including expired and replayed links. Preserve web behavior. |
| Notifications | `public/team-room-sw.js` and Team Room registration use browser push | Add native token lifecycle, APNs/FCM delivery, permission handling, logout cleanup, and authorized notification destinations. Browser push is not native delivery. |
| Billing | Stripe checkout, webhook, billing, and entitlement code exists | Select store/region purchase rules, map products to existing tiers, verify transactions server-side, process store notifications idempotently, and test restore/refund/expiry. Never grant access from a client purchase flag. |
| Account deletion | No dedicated deletion route was found in the targeted search | Audit existing profile/support flows, implement authenticated deletion with retention and subscription consequences, and satisfy store entry-point requirements. |
| Privacy | `app/legal/privacy/page.tsx`; analytics and advertising hosts in CSP | Inventory actual SDK/data collection and consent; prepare Apple privacy disclosures, Google Data Safety, and any applicable tracking permission. CSP entries alone do not prove collection. |
| Build tools | Windows host; Android SDK and default Android Studio paths absent | Install Android tooling for device checks; use a Mac/Xcode for iOS. No native compilation has been demonstrated. |

Existing uncommitted home, navigation, profile, and team edits were present during the audit. They are outside this change; mobile evidence must identify the exact source revision tested.

## First release scope

Setup progress after the initial audit: the Android toolchain and emulator are installed, and Windows hardware acceleration works. Native launch, real-link sign-in entry, Free QA sign-in, account-access HTTP 200, full process-restart session restoration, Logout, and signed-out relaunch are verified against the development candidate. Sign-in, fresh-process restoration, Logout, and signed-out entry also passed against the reused local production bundle on stable emulator 37.2.12. Supabase now selects Android Keystore-backed encrypted session storage on native platforms; browsers retain the existing storage path. The previous redirect did not reproduce through real menu navigation. The localStorage persistence failure did reproduce and was corrected for authentication with native storage. Audit other critical browser-only drafts before shipping, since a non-secret localStorage marker also failed the process-restart test. The prototype still loads a local web server through ADB reverse, so bundled-client API boundaries remain the next architecture gate. iOS and remaining lifecycle flows are unverified. See `mobile/device-results.md` for exact evidence and verification limitations.

Free: Explore and public player/team intelligence. Player: My Lab, follows, and matchup insight. Captain: Team Room, availability, published lineups, and weekly decisions. Keep complex league administration on the web for the initial release. Tier names and visible copy must use `lib/product-story.ts`.

## Milestones and acceptance gates

iOS is now the priority; Android work is deferred. The owner reports completing enrollment, while the Apple Developer account currently shows Pending. There is no Mac available. Windows-generated SPM sources, the approved app icon and shared Xcode scheme pass local source checks. A GitHub Mac simulator compile can be requested by manual dispatch or an explicit `ios-simulator` PR label. See `mobile/ios-cloud-build.md` for the compile, activation and signing gates. Source preparation is not iOS build/device acceptance.

October 23 bundled-client update: Android now packages sign-in and a read-only My Lab profile in local assets with no `server.url` or ADB reverse requirement. Synthetic QA sign-in, encrypted session restoration after force-stop, hosted profile authorization, network-loss recovery, and sign-out passed. The direct Supabase API boundary denied anonymous and other-account profile reads. See `mobile/README.md` for reproduction and `mobile/device-results.md` for evidence. This establishes the first Android extraction slice; iOS and custom Next.js API extraction remain open, as do paid features and the full My Lab toolset.

1. **Device feasibility:** use `mobile/` to exercise existing screens on both platforms. Capture login, resume, keyboard, navigation, link handoffs, and failure recovery. No architecture approval based only on browser emulation.
2. **Bundled client proof:** package a small client with login and one private view; prove protected API authorization across origins and secure session lifecycle. Decide Capacitor versus React Native from this evidence.
3. **Native continuity:** verified universal/app links, native notifications, external actions, offline/error states, accessibility, and phone navigation. Test cold and warm launches; never place bearer credentials in logs or analytics.
4. **Membership and account lifecycle:** implement store billing and entitlement reconciliation, restore purchases, account deletion, privacy and consent. Test web subscriber access and account switching without double subscription prompts.
5. **Beta and submission:** organization accounts, final app identifiers, signing, approved icons/splash assets, store screenshots and copy, reviewer test accounts, TestFlight/Play testing, privacy declarations, support links, and release versioning. Run full web regression verification before shared production changes ship.

Do not create paid deployments for local iteration. Use an existing suitable hosted environment only when testing hosted auth, notifications, purchases, or verified links requires it. Credentials, account enrollment, and physical device access remain external prerequisites; do not invent them.

## References

- Installed Next.js guide: `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` — request-dependent handlers and headers are unsupported in static exports.
- Capacitor configuration: https://capacitorjs.com/docs/config — remote `server.url` is intended for development.
- Capacitor build prerequisites: https://capacitorjs.com/docs/getting-started/environment-setup.
- Apple review and payment requirements: https://developer.apple.com/app-store/review/guidelines/.
- Google Play payments: https://support.google.com/googleplay/android-developer/answer/9858738.

Recheck store policies for the selected launch regions before implementing purchasing or submitting.

## Native team invite candidate (build 30)

My teams includes Join team for both connected players and players with no accepted team. Paste an existing TenAceIQ HTTPS team invite (or its UUID), review the exact team, league, flight, expiry and Player role, then confirm. Existing members can open the team without another join write. Invite tokens are sent only in the authenticated POST body to `/api/mobile/team-invites`; they are not stored by the client or opened as external URLs.

Apply `supabase/migrations/20261024000500_native_team_invite_join.sql` before releasing this client. The new server-only RPC uses the existing service role and existing tables. It validates current captain authority, invite validity, exact room scope and removal status, then joins atomically. A failed transaction rolls back membership, participant, preferences, notice, default-team updates and invite count. Replaying the reviewed invite preserves accepted roles, mute/read state and preferences, and does not repeat the notice or count. An inactive connection becomes Player only. A changed inactive connection or changed invite requires review again. No email opt-in, availability response or test notification is performed.

Uncertain delivery retains the same reviewed invite for manual retry; Close and refresh teams provides recovery if the first response was lost. Backgrounding or leaving the session discards late UI responses. Existing drafts and pending team actions must be finished before opening an invite. Local SQL tests execute the actual migration in PGlite with representative existing table definitions; they prove transaction rollback, replay and permission behavior, not multi-session concurrency. Positive app checks use a blocked-network synthetic team. Physical iPhone acceptance and real invite use remain pending; no production team was joined for testing.

## Native captain invite candidate (build 31)

Captain → Invite teammates manages the current captain’s own links for the selected exact team. Review and confirm a 30-day Player invite, then explicitly Share invite or Copy link. Sharing and copying use the official Capacitor Share (8.0.3) and Clipboard (8.0.1) plugins, registered in the generated iOS SPM project. No invitation is sent automatically. Each share/copy checks the current link list again; revoked or expired links cannot be shared through these controls. The native share sheet and clipboard still need physical iPhone acceptance.

A create intent uses one UUID as its invite-row identity across uncertain retries, including after revocation or expiry. Revocation targets one reviewed row; retry cannot revoke a newer link. Existing members and other captains’ links are unchanged. Five active links per captain/team are allowed; the list includes active links first and recent history, up to 20. Tokens stay in private response bodies and memory, with no client persistence. Pending uncertain revocation hides the link and disables other actions. Leaving the screen discards late results; reopening refreshes current state.

Apply `supabase/migrations/20261024000600_native_captain_invites.sql` before release. The endpoint requires existing Captain account entitlement and an accepted, unarchived exact-team captain/co-captain link. The server-only transaction rechecks current captain authority, room status, participant and removal state. Only the existing service role can execute it. Positive tests use actual SQL in local PGlite and a blocked-network browser fixture; no production invites were created, revoked, copied or shared for testing. Multi-session concurrency is not claimed. Existing website invite management is unchanged.

## Native captain chat access candidate (build 32)

My teams → Captain → Manage chat access reviews the selected exact team's connected, removed, and accepted-but-not-joined members. Search the loaded list (up to 250) by name or public TIQ ID. Review a named player before removing or restoring chat access. Self, captain/co-captain, coordinator participant, and administrator access are protected. Restoration requires a current accepted, unarchived Player connection and grants only a member participant role. Official roster links, team roles, past posts, and team preferences are unchanged. Saved read position and mute choice are restored; unknown legacy mute choices default to muted. No push, email, chat message, invitation, or availability response is generated.

Apply `supabase/migrations/20261024000700_native_team_member_access.sql` before release. The endpoint checks existing Captain entitlement and current exact-team captain authority. Only the existing service role can call the transaction or read/insert its private operation receipts. A frozen operation ID and reviewed member version survive uncertain retries. Durable receipts prevent an old removal from reversing a newer restore, and an old restore from reversing a newer removal. The screen requests a fresh member review when the state changes. One content-free chat signal is updated per committed human action; retry and idle views add no signal writes.

The same migration excludes removed members from the existing direct conversation RLS rules, including creator and own-post paths. Database triggers atomically save participant settings and delete the participant on removal, and serialize participant creation with removal/restore so legacy entry points cannot reinsert an excluded member. The older website invite GET and POST reject known removals before membership writes. Existing platform administrator RLS overrides are retained. This migration does not clean up or change existing team membership rows.

Local PGlite tests execute the actual migration, representative existing tables, and the existing conversation RLS policies as authenticated users. Coverage includes protected roles, stale review, exact scope, receipt replay/supersession, read/mute preservation, legacy rejoin denial, own-post/creator denial, unrelated conversation continuity, ACLs, and rollback after late failure. These checks do not establish multi-session concurrency. The actual bundled UI passed at iPhone width in a blocked-network synthetic fixture, including lost responses and a newer decision overtaking an old retry. Physical iPhone acceptance remains pending; no production member was removed or restored for testing.

The build 30 and 31 SQL files were renamed to unique native migration versions `20261024000500` and `20261024000600` without changing SQL contents. A read-only production migration-history check found no recorded `20261024` versions before renaming. Native migration version uniqueness is now tested. An unrelated older duplicate `20261002000100` remains a separate baseline cleanup; do not use an unreviewed bulk migration push for this release.

## Native conversation tools candidate (build 33)

My teams → Conversation adds All, Announcements, and Photos & GIFs filters. Filters and name/text search operate only on the loaded conversation page; Earlier messages reads an older page with the same filter. A filtered view never acknowledges hidden posts as read. Empty results identify the page boundary. Changing filter or search stops GIF playback. Reply and reactions stay visible; More reveals edit/remove for eligible own posts or report/block for other members, with native disclosure keyboard behavior and Escape dismissal.

Captains can open Post captain announcement, write up to 2,400 characters, review the exact team and text, and explicitly post. Review and opening the dialog generate no sends. Uncertain retries keep the same UUID, text, announcement kind, and empty reply destination. A known rejection requires review again. Closing, backgrounding, or leaving the session clears the private draft and ignores late UI results. Explicitly closing an uncertain send opens Announcements, refreshes the conversation, and looks for the original post without sending again. Successful posting selects Announcements and reveals the new post while preserving the separate conversation draft. The existing server send transaction and captain authority checks are reused; existing alert preferences apply and retries do not generate another notice. No new database schema, notification service, scheduled job, permission, or plugin is added.

The owner can edit or soft-remove a plain announcement, with exact body/version/metadata/kind checks. Formal workflow announcements remain protected. Positive verification uses local mocks and the actual bundled UI with blocked-network synthetic data; no production announcement, edit, removal, or notification is generated for testing. Physical iPhone acceptance remains pending.

## Native message context candidate (build 34)

Tap a quoted reply to open its original text, including an original outside the loaded conversation page. More → View message opens a reviewed text view for any available post. The read-only `/api/team-rooms/message` endpoint forces the existing read-only chat branch, verifies the current accepted exact-team scope, participant/removal state, and block settings, then reads at most the source and its same-room original. Removed, blocked, or unavailable posts return no content. Responses are private/no-store and contain bounded text, name, times, kind, and attachment-presence flags; no storage path, signed URL, reaction identities, or workflow metadata is returned. No read acknowledgement, message, notification, or membership write is made.

Copy text checks the current message and access again before writing through the existing native Clipboard plugin. Changed text or identity is shown for review and requires another explicit copy; unavailable content is cleared. Up to 8,000 characters are shown, with Copy preview identified for longer legacy posts. Attachments remain in the conversation. Ordinary chat drafts and the conversation page are preserved. Closing, backgrounding, session change, or team removal clears these private views and ignores late results.

HTTPS links in post text and reviewed messages open a destination preview showing the host and complete URL. Only an explicit Open website invokes the existing native Browser plugin, with no app bearer headers. Other schemes, credentials in URLs, backslashes, control characters, and oversized URLs are not made clickable. No link-preview crawler or external request runs on display. More menus stay open during incoming updates; one deferred refresh catches up after closing or leaving the menu. Existing polling cadence is unchanged.

Focused tests cover room/owner/source/target checks, blocks/removals/deletions, malformed replies, bounded projection, fixed transport, copy revalidation, and URL/HTML safety. Positive phone-width checks use the actual client with blocked-network data and synthetic browser/clipboard adapters, including older originals, changed/denied copies, preserved drafts, and menu stability during incoming updates. No production post, report, membership, alert, clipboard, or external-browser action is used as a positive test. Physical iPhone acceptance remains pending. No migration, plugin, credential, permission, scheduled job, or notification service is added.
