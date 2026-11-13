# TenAceIQ mobile feasibility prototype

Apple is the current priority; Android work is deferred. Signed TestFlight builds are active through build 82. The owner has no Mac; the protected GitHub Mac workflow signs and uploads internal betas. Current scope and acceptance limits are tracked in [website-to-iPhone parity](../docs/mobile-website-parity.md). The early feasibility instructions below are retained as historical setup notes; they do not describe the current Apple enrollment or release state.

## Bundled My Lab proof (October 23, 2026)

### Password recovery and account help

Forgot password opens a bundled email form. It requests Supabase recovery with the fixed existing HTTPS return route `https://www.tenaceiq.com/reset-password`. The user opens the email link in their browser, chooses a new password on the existing website, and returns to the app to sign in. No email address or recovery credential is placed in app navigation or persisted by the recovery UI. Successful submission uses a non-enumerating message and a one-minute resend cooldown; duplicate pending submissions are ignored. A 429 response starts the same cooldown. Other failures permit retry, and leaving the form prevents late responses from changing the sign-in screen.

Privacy, Terms and Support appear on sign-in, recovery and My Lab. The official Browser plugin opens only three fixed public destinations. No bearer token or account identifier is attached. Android Back returns from recovery to sign-in. This is browser-based recovery completion; verified app/universal links, native email callbacks and automatic return to the app are **not implemented**. No Supabase redirect configuration was changed.

Run `node mobile/scripts/smoke-recovery.mjs` against the signed-out bundled Android WebView. It intercepts **all** requests to the recovery endpoint before network delivery, validates the email/redirect contract, and supplies controlled success, 429 and network-failure responses. It also checks pending duplicate submission and a late response after returning to sign-in. It never sends real emails or changes passwords; the screenshot `evidence/android-password-recovery.png` is captured with a blank email field. These checks do not establish live email delivery, allowlist acceptance or completion of a real reset link. A separate authorized synthetic-inbox test must verify those before release.

There is currently no user-owned Mac available. Prepare iOS sources locally, then select a cloud Mac build/signing lane and supply Apple account/signing access before claiming iOS acceptance. No paid build service or Apple account has been provisioned.

Each recent result now opens a match-detail screen with its recorded score and the players on sides A and B. The linked player's side is marked. Back restores the existing results list, scroll position and keyboard focus without refetching the list. Android system Back uses the official `@capacitor/app` plugin; at My Lab/sign-in it minimizes the app. Detail URLs use only `#match`, with no account or match identifiers. Selection stays in memory and is discarded on account change or full refresh. A cold launch starts at My Lab.

With the Player QA fixture signed in, run `node mobile/scripts/smoke-bundled.mjs details` and `node mobile/scripts/smoke-bundled.mjs details-retry`. For system Back, run `open-detail`, send Android key event 4 using ADB, then run `detail-returned`. `preview-details` saves a screenshot only after replacing visible fixture content with sample names, league, date, result and score; it is a layout preview rather than private match evidence. The player-detail request has its own error/retry state and a 12-second timeout.

My Lab also shows up to ten recent connected matches: date, singles/doubles, league, recorded score and won/lost/pending result. A single inner-join request filters by the linked player before ordering and limiting; it avoids downloading the global match list. Missing identity, no results, unknown outcomes and match-only API errors each have separate states. Retry matches preserves the profile controls. This is a basic results view; Player analysis and paid tools remain outside this slice.

For populated-results acceptance, sign out first and use `node --env-file=.env.local mobile/scripts/smoke-bundled.mjs login PLAYER`, followed by `node mobile/scripts/smoke-bundled.mjs results-retry`. The Player QA fixture has connected matches; Free QA exercises the unlinked state. The retry smoke temporarily blocks only the match endpoint, checks the independent error state, then unblocks it and retries. It clears inspector request blocking in cleanup and never prints match contents. Finish with the logout phase.

The first standalone screen is now in `src/`: sign-in and a read-only My Lab linked player/team/league profile. Its HTML, CSS, JavaScript and approved logo ship inside the APK. It calls the existing Supabase HTTPS Auth and PostgREST APIs directly using the public publishable key and the signed-in user's bearer token. Existing row-level security protects profile access. No privileged keys, Next.js server, ADB reverse tunnel, or backend deployment are required. This does not yet port Player analysis, paid entitlements, profile editing, or the rest of My Lab.

From the repository root, install root dependencies, then from `mobile/` run:

```powershell
npm ci
npm run build:bundled
npx cap sync android
```

Build/install with the Java 21 Gradle commands below. `build:bundled` switches the generated Capacitor configuration to `webDir: bundled` with no `server.url`. `prepare:device` switches back to the older server-loaded harness. Sync and rebuild after switching modes. Generated `bundled/` assets are ignored and reproducible from source; public config and shared secure-storage/product-language modules are imported from the root, so root `npm ci` is required too.

The Android bundled origin is `https://localhost`; a content security policy limits WebView network connections to the configured Supabase host. Public account-help pages open separately through the Browser plugin. The existing native encrypted session adapter is shared with the web harness. Profile content stays in memory only and is cleared on sign-out. Offline launch can open the bundled screen; fresh account/profile data requires network access. A failed profile request shows a retry action, and reconnect automatically refreshes. Live password-recovery acceptance, deep links, account creation, store billing, and iOS acceptance remain future work.

After forwarding the WebView inspector as below, run these from the repository root against the synthetic QA fixture:

```powershell
node mobile/scripts/smoke-bundled.mjs entry
node mobile/scripts/smoke-bundled.mjs offline-entry
node --env-file=.env.local mobile/scripts/smoke-bundled.mjs login
# Force-stop/relaunch Android and forward the new WebView PID before restore.
node mobile/scripts/smoke-bundled.mjs restore
node mobile/scripts/smoke-bundled.mjs offline
node mobile/scripts/smoke-bundled.mjs logout
node --env-file=.env.local mobile/scripts/check-profile-boundary.mjs
```

The smoke reports phase results only. The entry screenshot is signed out. The boundary check asserts anonymous denial, own-profile visibility, and denial of other profiles without printing profile fields or identifiers. Offline testing uses the WebView inspector's network emulation and restores connectivity in cleanup. It does not prove every native networking path or a physical device's airplane-mode behavior.

This is a Capacitor 8 development harness for testing the current Next.js application in a device WebView. It is not a store-ready application. The shared Supabase client now selects encrypted native session storage on Capacitor; ordinary browsers retain their existing storage path. Deployment settings are unchanged.

## Run locally

1. Start Next.js from the repository root: `npm run dev -- --hostname 0.0.0.0 --webpack`.
2. In this directory, run `npm ci`.
3. For the Android emulator, run `npm run prepare:device -- http://localhost:3000`, then run ADB `reverse tcp:3000 tcp:3000` as shown below.
   For a physical phone on the same trusted network, use the computer's private LAN IP instead. For an iOS simulator on a Mac, use `http://localhost:3000`.
4. Run `npm run add:android` once, then `npm run open:android`. Android Studio and the Android SDK must be installed. Launch on an emulator or connected test device.
5. On a Mac with Xcode, use `npm run add:ios` and `npm run open:ios` instead.
6. After changing the server URL, run `npm run sync` before rebuilding in the native IDE.

Run `npm run doctor` in this directory to check Node, Java, API 36, build tools, ADB, connected devices, the local login route, and unauthenticated API rejection. A nonzero exit means setup is incomplete; the output names each missing prerequisite. The emulator URL is translated to loopback only for the host-side server check.

## iOS launch tracks

Both tracks use the existing TenAceIQ App Store record. In TestFlight, open TenAceIQ and choose **Previous Builds** to switch between the two betas. The selected build replaces the installed build on that device. [Apple TestFlight help](https://testflight.apple.com/)

| Track | TestFlight baseline | Release condition |
| --- | --- | --- |
| Integrated TenAceIQ | [1.0 (254)](https://github.com/TNM91/tennis-data/actions/runs/42731383414), `codex/apple-mobile-build` | Obtain written permission covering the integrated data and verify that the candidate and store disclosures match that permission. |
| First-party fallback | [1.0 (255)](https://github.com/TNM91/tennis-data/actions/runs/42754005907), `codex/ios-first-party-release` | Use TenAceIQ content and records the product can publish independently. Build 255 passed the owner's iPhone offline check. The current candidate uses the full app described below. |

Both baselines are internal TestFlight builds. Submit the selected track from a separate App Store–eligible archive with matching screenshots, privacy disclosures, and App Review notes. [Apple distribution options](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases/)

### First-party launch scope

- **Available in build 255.** Offline drills, a timer, self-entered matches and recent form.
- **Full-app candidate.** `npm --prefix mobile run build:bundled -- --first-party-preview` builds the integrated app shell and assets into `.next/mobile-first-party-preview`. The preview omits external uploads and imports, skips the imported ratings and match history reads in My Lab, and sends tournament browsing, registration and saved entries to the signed-in `/api/mobile/first-party/tournaments` routes for approved records.
- **Chats.** Coach invites and direct coach-player messages use their dedicated account routes. Team chat and team invites use the reviewed team routes described below. Compete → My Teams opens the same conversation as Chats.
- **Hold for verified rights and data scope.** External imports, imported directory and match history, and ratings computed from those records. The fallback bundle and its server endpoints should enforce the scope before returning data. Hiding a screen alone leaves other paths to the same data.

Explore and Compete share the reviewed TenAceIQ league feed. Guests can browse approved public leagues. Signed-in users can also see their own submissions and seasons they organize. Explore holds player search, team search and rankings until those views have first-party sources. League registration and League Office stay outside the candidate until their management routes enforce the same data scope.

The **Mobile iOS signed build** workflow packages the full app with profile **first-party-full**, distribution **internal**, and a unique build number above 255. It uses the app’s native project and verifies the full-app scope in the exported IPA. With **Upload** enabled, the workflow first checks all scoped routes on `www.tenaceiq.com`. Deploy the candidate routes, apply the Updates migration, and verify a signed-in account before enabling upload. Use **Check TestFlight** and **Assign previous group** to confirm availability in the verified internal group after Apple processes the build.

My Lab opens from the signed-in account. Saved training, coaching and the private training notebook work without a linked player. New notebook goals stay in an account scope separate from existing player-linked goals. Following, Matchup and shared scorecards remain on hold until their data has a first-party source.

The full-app match log uses account-owned `native_personal_matches` rows for manually entered scores and Recent Form. Reviewed calendar matches prefill the date and opponent, plus the format when the tournament division supplies it. Each account can save one linked scorecard per calendar match and reopen it from the same fixture. Manual entries without a fixture stay separate. The link supports future score reconciliation. These records are private.

Before distributing a build with this log, apply `20261110000200_restore_updates_erasure_catalog.sql`, `20261110000300_native_personal_matches.sql`, and `20261110000400_native_captain_court_results.sql` in order if pending. Verify the account-deletion catalog, then open, save, reopen, edit, and remove a calendar-linked scorecard with a QA account.

For a reviewed TenAceIQ team fixture, open **Schedule → Open court scores**. Both teams need reviewed rooms and the court players must have active TenAceIQ team memberships. The captain posts the completed set score in team order. A signed-in participant sees the posted score in My Lab. A private entry started from the same court remains available from the captain scorecard and counts once in Recent Form. Private entries created without a court link stay separate. Test with a captain, both teams’ players, and an unrelated account before distribution.

#### Calendar

Personal dates entered in My Lab and dates shared by a connected coach use the signed-in account. The candidate skips imported schedule copies and dates extracted from team messages. League fixtures and tournament draws reuse the same revision approvals as Explore and Compete. The calendar checks the signed-in player's active league entry or approved tournament entry before showing dates or accepting availability replies. A division also needs its parent event approved. Team practice invitations stay outside this calendar until they have a separate reviewed source.

#### Updates

The candidate shows short previews for notices tied to a current Coach conversation, a shared weekly plan, or an account, billing, or general support request. Coach links open the existing conversation or plan. Support previews can be marked read in the app. Team, schedule, import, and competition-entry alerts stay outside this feed until their sources can be checked. Coach and team message counts are available in Chats.

The Updates list, unread badge, and read actions use the same signed-in scope. Apply `20261110000100_native_first_party_updates.sql` to the candidate backend before testing the scoped route with a real account.

#### Review a team conversation

Confirm the team and league names, flight, and exact General conversation UUID against the TenAceIQ team record. Review what the room has been used for, including its existing messages. Use the server-only `TIQ_FIRST_PARTY_TEAM_ROOMS` setting for approved rooms. This example uses fictional data.

```json
[{"teamName":"Baseline Aces","leagueName":"City League","flight":"4.0","roomId":"10000000-0000-4000-8000-000000000002"}]
```

The candidate shows approved teams only to members with an active invite or TenAceIQ entry and checks room membership on conversation reads and writes. Team invites must match the approved team and exact room. If the setting is empty, there are no team conversations or usable team invites in the candidate. Remove the approval to withdraw the conversation from the first-party feed.

Approved chats support text, replies, reactions, read position, manual refresh, reports and blocks. Teammate labels use account-based aliases. The candidate holds attachments, named rooms, push registration, team plans and match cards, roster details, and captain tools pending separate data checks. Before distributing a signed candidate, verify what happens to existing push registrations when upgrading from the integrated build on the same iPhone.

The full-app preview is for local verification with synthetic data. It has no signing target or workflow option. Before packaging it, scope the League Office and entry paths, team data and related links, then verify the network boundary on an iPhone. Build 255 remains the offline TestFlight baseline.

#### Approve a league season

Export each season's JSON from the authenticated `GET /api/mobile/competitions?scope=discover&league=<id>` route. Review the summary, public participants, schedules, results and standings. Confirm that TenAceIQ can publish every record in that snapshot. Keep the export outside the repository and generate the approval value:

```sh
npx tsx scripts/fingerprint-first-party-leagues.ts path/to/reviewed-season.json
```

Pass multiple file paths to approve multiple seasons. Set the output as the server-only `TIQ_FIRST_PARTY_LEAGUE_APPROVALS` value. With no approvals, the catalog is empty. A changed summary or detail needs review and a new fingerprint before that content can appear.

#### Approve a tournament revision

Review the event and each division separately. Confirm the origin and publishing rights for the event details, entrants, schedule and results before approving. Public visibility by itself does not grant first-party approval.

Export only the reviewed rows from `tiq_tournaments` to a local JSON array. Use the fields in `nativeTournamentDrawColumns` in `lib/native-tournament-approvals.ts`. Keep the export outside the repository. Generate the approval value from the reviewed snapshot:

```sh
npx tsx scripts/fingerprint-first-party-tournaments.ts path/to/reviewed-rows.json
```

Set the output as the server-only `TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS` value for the candidate backend. The route accepts up to 50 rows, including events and divisions. With no approvals, the catalog is empty. Edits to an approved revision require review and a new fingerprint. Removing an approval withdraws the record from the first-party feed. Review records against the updated feed before connecting a TestFlight build.

For events accepting in-app entry, include the fields in `nativeTournamentEntryColumns` in the reviewed export and pass `--entry` after the file path. Add entry approvals to the parent event and each division accepting requests. Apply `20261112000800_native_first_party_tournament_entry.sql` before testing entry, organizer decisions, and receipts on the candidate backend. Entry receipts use the approved registration metadata, so an organizer can keep reviewing requests while a changed draw awaits publication. Publish a fresh draw fingerprint after adding players or changing court assignments so players can see those matches in My Event and Calendar.

### Offline baseline build

Use a separate checkout for the first-party fallback because bundling writes the checkout's Capacitor configuration. From the repository root, with both dependency sets installed, run:

```sh
npm --prefix mobile run build:ios:first-party
npm --prefix mobile run prepare:ios:first-party
npm --prefix mobile run check:ios:first-party
```

The offline prototype packages its assets from `mobile/bundled-first-party/` into `mobile/ios-first-party/App/App.xcodeproj`. It includes timed footwork, serve and between-point drills with the last saved session per drill, plus an editable match log with recent form. Practice and match records stay on the device. Its JavaScript has an explicit source allowlist and the WebView page blocks network connections.

The fallback links only core Capacitor. The check command verifies the packaged assets, plugin registrations, default bridge, and absence of the beta's StoreKit source, permissions and push entitlements. Open the project under `ios-first-party/` for simulator or device work. The standard beta still uses `mobile/ios/`.

To compile and launch the unsigned fallback on the Mac runner, select **first-party** when manually running **Mobile iOS simulator build** from the fallback branch. The three-day artifact contains the simulator app and a launch screenshot. From GitHub CLI:

```sh
gh workflow run mobile-ios-simulator.yml --ref codex/ios-first-party-release -f profile=first-party
```

Add `-f device_only=true` to compile the offline Release with the iPhone SDK and verify the arm64 binary and packaged assets. The device check uses no signing credentials and skips simulator startup. Physical installation requires a signed build.

The **Mobile iOS signed build** workflow can export the fallback as an internal-only IPA for the existing TenAceIQ app ID. It verifies the exported assets and signed entitlements before saving the IPA. The `apple-testflight` environment must explicitly allow `codex/ios-first-party-release`, and the existing reviewer approval still applies. Select **first-party**, **internal**, and leave **Upload** off. A separate App Store Connect upload is needed for TestFlight installation.

Before preparing an App Store candidate, verify the data provenance of any connected features, test the selected package on an iPhone, and review the listing and privacy disclosures against that package.

## Native sessions and sign-in smoke

Run `npm ci` in both the repository root and `mobile/`, then sync and rebuild the native APK when native dependencies change. `@aparajita/capacitor-secure-storage` must be included in the APK; serving updated web code to an older APK without the plugin will not initialize native auth. Native storage failures do not fall back to plaintext browser storage.

`lib/native-auth-storage.ts` uses Android Keystore-backed AES-GCM storage for Supabase's session strings. The iOS configuration selects device-only keychain access while unlocked and disables iCloud sync; it has not been device-tested. The plugin is only loaded on native platforms. Existing browser sessions are not migrated into the native store; sign in again on the prototype after this update.

To run the signed-out entry check, forward the app's WebView inspector after launching the emulator and applying the reverse tunnel:

```powershell
$mobileSdk = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
$mobileAppPid = (& "$mobileSdk/platform-tools/adb.exe" shell pidof com.tenaceiq.prototype).Trim()
& "$mobileSdk/platform-tools/adb.exe" forward tcp:9223 "localabstract:webview_devtools_remote_$mobileAppPid"
npm run smoke:auth-entry
```

This expects exactly one connected Android device, a signed-out local WebView, and Node 22+. It opens Home → menu → Sign in, waits for email/password inputs to remain visible, verifies JSON 401 from the account-access API, and saves a public screenshot to `evidence/android-sign-in.png`. It never enters credentials or submits the form. Re-forward the inspector when Android changes the app process ID.

Authenticated acceptance uses the existing Free QA fixture credentials from local configuration without logging passwords, tokens, identifiers, or private page contents. Verify account access 200, force-close/relaunch restoration, Logout, and signed-out relaunch. Do not substitute real member credentials or add them to screenshots or source files.

On this Windows host, the initial Turbopack session returned HTML 404 for `/api/auth/access`; restarting with webpack returned the expected JSON 401. Use webpack for this prototype until the Turbopack discrepancy is resolved. This finding does not establish a production routing failure.

## Windows build runtime

Use Java 21 for Gradle 8.14.3. Android Studio 2026.2 includes Java 25, which is too new for this generated Gradle wrapper. In Android Studio, select Java 21 as the Gradle JDK. For a PowerShell build from this directory with Microsoft OpenJDK 21 installed:

```powershell
$env:JAVA_HOME = (Get-ChildItem 'C:/Program Files/Microsoft' -Directory | Where-Object Name -Like 'jdk-21*' | Select-Object -First 1).FullName
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
if (-not $env:JAVA_HOME) { throw 'Install Microsoft OpenJDK 21 or set JAVA_HOME to a Java 21 installation.' }
& ./android/gradlew.bat -p ./android :app:assembleDebug --console=plain --no-daemon
```

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. It connects to the configured local server and is not a standalone or store release. Native projects remain generated and ignored.

For accelerated Windows emulation, enable **Windows Hypervisor Platform** in Windows Features and restart if requested. Keep the local Next.js server running while testing. Do not restart the computer during an active task without saving work.

On this host, Windows Hypervisor Platform alone did not activate a hypervisor. Administrator diagnostics after the first restart found the underlying Hyper-V hypervisor disabled. That component is now enabled and automatic hypervisor startup is configured; Windows requested another restart. Run `-accel-check` after that restart before attempting emulator launch.

## Run the prepared Windows emulator

This machine has a prepared virtual device named `TenAceIQ_Pixel6_API36`. Hypervisor activation and Android boot have now been verified. Start the local webpack server from the repository root, then run these commands in PowerShell from `mobile/`:

```powershell
$mobileSdk = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
& "$mobileSdk/emulator/emulator.exe" -accel-check
& "$mobileSdk/emulator/emulator.exe" -avd TenAceIQ_Pixel6_API36 -gpu swiftshader -feature -Vulkan -no-snapshot
```

In another terminal, once Android has booted:

```powershell
$mobileSdk = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
& "$mobileSdk/platform-tools/adb.exe" devices
& "$mobileSdk/platform-tools/adb.exe" reverse tcp:3000 tcp:3000
& "$mobileSdk/platform-tools/adb.exe" install -r ./android/app/build/outputs/apk/debug/app-debug.apk
& "$mobileSdk/platform-tools/adb.exe" shell am start -n com.tenaceiq.prototype/.MainActivity
npm run doctor
```

Do not proceed past a failed acceleration check. These install commands assume the emulator is the only connected Android device. Reapply the reverse tunnel after restarting the emulator. This host could not initially reach `10.0.2.2:3000`; `localhost` through ADB reverse successfully rendered the application. `127.0.0.1` reached the server but triggered a Next.js development-origin warning, so prefer `localhost`.

The original runtime was emulator 37.3.5 from Google's beta channel and its Windows QEMU process crashed twice. It has been replaced with stable 37.2.12; the beta files are preserved outside the SDK in `Android/tenaceiq-tool-backups/`. The launch command above also disables Vulkan using Android's documented troubleshooting option: https://developer.android.com/studio/run/emulator-troubleshooting. Stable-runtime production-bundle sign-in and process-restart persistence checks passed. Extended emulator reliability and physical-device behavior still need testing.

Use synthetic test accounts and test data. Local HTTP is only for trusted development networks. Do not enter production credentials in this prototype. No secrets belong in Capacitor configuration or bundled assets.

The generated configuration accepts only loopback or private IPv4 origins. It has a separate prototype identifier. Native projects and device configuration are ignored because they contain machine-specific development settings and stock Capacitor assets. Production identifiers, artwork, signing, and release configuration are a separate milestone.

## Evidence to capture

Run each check on an Android device and an iPhone; record device/OS, commit, outcome, and reproduction steps in `device-results.md`.

| Flow | Acceptance |
| --- | --- |
| Explore | Search and open a player; back navigation returns to useful context. |
| Login | Sign in with a test account; My Lab and `/api/auth/access` resolve without a loop. |
| Session | Background/resume, force-close/relaunch, sign-out, and account switching preserve the correct identity. |
| Team Room | Open a test team, read and send a message, use the keyboard without hiding controls. |
| Availability / lineup | Open a test invitation, save availability, and read the published lineup. |
| Connection loss | Launch without network and interrupt a save; recover without falsely reporting success. |
| External actions | Verify share, SMS, calendar, and external links; record browser handoff behavior. |
| Purchases | Do not purchase. Inventory every upgrade and billing link for the native billing work. |

Email links, native push, and store purchases are expected gaps, not completed prototype features. A successful hosted-page WebView test does not prove that bundled assets can use cross-origin APIs.

## Architecture gate

Capacitor documents `server.url` as a live-reload development option, not a production deployment strategy: https://capacitorjs.com/docs/config.

Before store work, prove a bundled client can authenticate and call one protected hosted API with explicit origin handling, secure session storage, and no privileged keys. The existing relative API URLs and request-origin checks need deliberate adaptation. If that extraction demands widespread rewrites, compare React Native before expanding this harness.

See [the readiness audit](../docs/mobile-app-readiness.md) for implementation order and release gates.
