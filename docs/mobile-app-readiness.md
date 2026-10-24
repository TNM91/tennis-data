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

Apply `supabase/migrations/20261024000100_native_team_invite_join.sql` before releasing this client. The new server-only RPC uses the existing service role and existing tables. It validates current captain authority, invite validity, exact room scope and removal status, then joins atomically. A failed transaction rolls back membership, participant, preferences, notice, default-team updates and invite count. Replaying the reviewed invite preserves accepted roles, mute/read state and preferences, and does not repeat the notice or count. An inactive connection becomes Player only. A changed inactive connection or changed invite requires review again. No email opt-in, availability response or test notification is performed.

Uncertain delivery retains the same reviewed invite for manual retry; Close and refresh teams provides recovery if the first response was lost. Backgrounding or leaving the session discards late UI responses. Existing drafts and pending team actions must be finished before opening an invite. Local SQL tests execute the actual migration in PGlite with representative existing table definitions; they prove transaction rollback, replay and permission behavior, not multi-session concurrency. Positive app checks use a blocked-network synthetic team. Physical iPhone acceptance and real invite use remain pending; no production team was joined for testing.
