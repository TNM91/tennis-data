# TenAceIQ mobile feasibility prototype

Apple is the current priority; Android work is deferred. The owner has completed enrollment, while the Apple Developer account currently shows Pending. The iOS source project can be generated on Windows with `npm run prepare:ios` after `build:bundled`; `npm run check:ios` verifies packaging. The GitHub Mac simulator workflow and signing steps are documented in [ios-cloud-build.md](ios-cloud-build.md). The owner has no Mac.

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
