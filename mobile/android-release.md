# Android release preparation

The Android lane packages the full first-party TenAceIQ app, starting from the TestFlight 353 source. It does not revive the older server-loaded prototype or change the Apple submission. External data imports remain excluded.

## Latest internal release — November 27

**Build 5 is available on the existing Google Play internal track, with T1 selected and its two testers retained.** The release uses app commit `e00a17118dbcbb739d2e502d3aa1f24cbe25482b`. All thirteen CI jobs passed without a retry in run `46068190434`. Native release compilation, lint and strict signature verification passed; all 1,078 original payload files were unchanged by signing. Google accepted version 1.0 (5), target SDK 36, with no blocking errors. Its only validation warnings concern optional deobfuscation files and native debug symbols. The signed bundle SHA-256 is `fbe1221ce30903e361b9bbd8c44251fc537c914ef08dfedcb6fab0a93895121d`.

Build 4 introduced Android coaching and hitting-reminder notification support from app commit `c09689175c956bffa65a42a9fab0a5dba9e7aeef`. Its thirteen CI jobs passed; one WebKit tactics timeout passed when only its Coach job was retried.

The focused API release, PR #1873, passed every check and deployed from production commit `de7c6baa549622323c62407d7219d301b511f4fb`. The owner subsequently approved production Android activation. One configuration-only redeploy of that verified commit activated sending; authenticated live checks returned both Android and iPhone availability true. No additional source change was merged or deployed for activation.

**First-party coaching notification acceptance passed on the Play-installed build 4 Android 16 emulator.** Sign-in survived the update and a clean restart. Device registration and the account coaching opt-in saved through the app. With the app backgrounded, a synthetic player's check-in produced the generic alert “You have a coaching update.” Tapping it opened the matching completed assignment and check-in. Coaching opt-out, device registration revocation and restoring both choices returned confirmed app receipts. The private fixture is retained for inspection; no real student or team record was changed. The bounded production warning/error log check was clear.

The already-open app retained its pre-activation unavailable coaching capability until a clean restart. Rechecking that capability from settings without a restart is a follow-up. Android Settings also stalled during the emulator restart procedure and recovered; do not attribute that system-app stall to TenAceIQ. Physical Android lock-screen acceptance is not established by this coaching test. Google checkout remains disabled pending merchant activation and real license-test acceptance. The Apple submission was not replaced or withdrawn.

The next private hitting-plan test delivered the generic background reminder “Your hitting plan is coming up.” on build 4. Tapping while its conversation was already open left the proposal stale, even though the partner's acceptance was confirmed through the production API. This is a failed tap handoff, not full hitting-reminder acceptance. The synthetic plan was cancelled through the API afterward, with no accepted test plan left on the owner's calendar. No court booking or real-player invitation was made.

The build 5 client fix refreshes the matching open conversation in place, including chats entered from the Chats list. It preserves unsent messages and source navigation, refuses to interrupt plan editing or another foreground dialog, and rechecks the current plan before focusing it. A cancelled or changed plan receives the existing changed-plan message. All six focused phone-browser checks passed across Android/iPhone controllers and Chromium/WebKit engines. Build 4 does not contain this fix.

**Hitting-reminder delivery and tap acceptance passed on Play-installed build 5 in the Android 16 emulator.** The generic background reminder opened the already-open private conversation, changed the proposal to Confirmed, displayed the correct time and club, and preserved the unsent “Test” message. Directions showed the matching club with Apple Maps and Google Maps choices; external map-app navigation was not exercised. Cancellation through the app returned a confirmed cancelled card. A database read independently confirmed cancellation and zero chat messages, so the test draft was never sent. No accepted test plan remains. Evidence is `output/android-activity-push-20261127/hitting-reminder-acceptance.json` in the main checkout.

An earlier build 5 attempt was interrupted when the entire emulator host exited. The same device restarted without wiping its data; build 5 and the signed-in account were retained, and the fresh retest above completed. Windows crash metadata did not identify a cause. Do not label that interruption as an established TenAceIQ crash, or treat emulator acceptance as physical Android lock-screen acceptance.

### Prepared for the next app build

Coaching notification settings now reread availability when reopened. An unavailable provider offers an enabled Check Coach alerts action instead of a disabled opt-in button; checking never enables alerts. The same read resolves an interrupted save without repeating it. Device registration is still required before opting in, and existing owner/epoch checks reject stale responses. Reads are limited to settings entry or an explicit check, with no polling. This client change is not included in Android build 5 or the existing TestFlight build, and does not change the Apple submission.

Focused verification passed: 16 Chromium/WebKit phone-browser checks, 24 related unit tests, lint on the changed source/fixtures and repository type checking. Existing opt-ins can still be disabled while provider delivery is unavailable. The full native release gates and signed package remain for the next batched app build.

## Local developer build

Use Node 22, Java 21, Android SDK platform 36 and the Build Tools version selected by the locked Capacitor Android template. Install dependencies at the repository root and in `mobile/`. Set `ANDROID_HOME` to the installed SDK and `JAVA_HOME` to Java 21.

From the repository root:

```powershell
npm ci
npm ci --prefix mobile
$env:TIQ_ANDROID_DISTRIBUTION='internal'
$env:TIQ_ANDROID_BUILD_NUMBER='1'
npm run build:android --prefix mobile
npm run prepare:android --prefix mobile
npm run check:android --prefix mobile
./mobile/android/gradlew.bat -p ./mobile/android :app:assembleDebug :app:bundleRelease :app:lintRelease
```

On macOS/Linux, use `export` for environment variables and `./mobile/android/gradlew` instead of the Windows wrapper.

The generated `mobile/android/` project and `mobile/bundled/` assets are ignored, like the generated iOS project. Preparation refuses an unrelated Android project or changes to managed files. Keep the original prototype in its existing checkout; generate this project from the release checkout.

- Developer APK: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`, package `com.tenaceiq.app.dev`.
- Unsigned release bundle: `mobile/android/app/build/outputs/bundle/release/app-release.aab`, package `com.tenaceiq.app`.
- Android build numbers are independent of Apple's build numbers. Use a new positive integer of at most nine digits for each eventual Google Play upload.
- `TIQ_ANDROID_DISTRIBUTION=internal` includes the existing private tournament test tools. `store` excludes them. It does not enable Google Play purchases or make the bundle ready to publish.
- `TIQ_IOS_DISTRIBUTION` continues to control iOS independently. Existing iOS commands and packaging configuration are preserved.

Debug builds permit local WebView inspection. Release builds disable it, reject cleartext HTTP and use bundled assets instead of a remote development server. Session storage uses the existing native encrypted adapter. Android backup and device-transfer copies of application data are disabled. The original approved app icon is copied unchanged from `public/brand/`.

`check:android` verifies source configuration, first-party scope, copied app/theme bytes, application identity and approved icon bytes. It does not replace native compilation, release lint, emulator/device acceptance, signing or Google Play review.

## Windows emulator checkpoint - November 27

A separate Pixel 6 virtual phone, `TenAceIQ_Play_API36`, is installed and booted with Google's Android 16 Play Store image (`system-images/android-36/google_apis_playstore/x86_64@7.0.0`). Windows Hypervisor Platform is usable. The emulator uses two virtual CPUs, 2,560 MB RAM, software graphics and a 3 GB data partition; large boot snapshots are disabled. The earlier foundation AVD is preserved.

Run `output/android-emulator-20261127/Start-TenAceIQ-Android.cmd` from the main checkout to reopen it. Close the emulator normally when finished to release its CPU and memory. The launcher preserves its data and refuses to start a second emulator when one is already running.

Developer build 3 remains installed as `com.tenaceiq.app.dev` for development checks. The real T1 release, **`com.tenaceiq.app` version 1.0 (3), is now installed by `com.android.vending`** on the Android 16 emulator. Google Play's initiating installer and four installed APKs were verified. The installed base APK passes v2/v3 signature and Google source-stamp verification, and its RSA-4096 certificate fingerprint matches the previously observed Play Console Asset Links fingerprint (`F1:00:99:F0:01:12:60:B4:B0:5C:CD:C4:41:8F:17:88:7B:A2:D2:8A:1B:5A:4F:99:65:52:9D:9C:87:D4:6F:1F`). All 23 bundled asset files match the uploaded AAB.

The installed release passes welcome/launch, guest Explore with court listings, account-entry handoff and native Back checks. A Back gesture exits guest Explore; on account entry, the first Back gesture dismisses the input interface and keeps the form open, and the next returns to welcome. The earlier toolbar/shortcut ambiguity was resolved by using the gesture inside the virtual screen. No obvious clipping was observed on these entry screens. The developer build's additional league listing/Close observations remain recorded separately.

Google Play sign-in, the owner-approved test invitation and installation verification are complete. The owner signed into TenAceIQ with the existing iPhone app account. On the Play-installed release, My Lab, Explore, Chats, Compete and More load. Team chat, pin/unpin persistence across tab navigation, captain practice creation, next-match scheduling, team results, private league navigation, coach students and assessment entry, TiQ self-assessment choices, week/month calendar, tactics full-screen/exit and signed-in background/resume were exercised. The production package was confirmed in the foreground after resume; a bounded Android crash-buffer read returned no entries. The temporary chat pin was restored, the next-match draft was cancelled, and the scorecard draft was discarded.

The subsequent private league acceptance passed on the same Play-installed build 3. In TestFlight Score Review, the owner submitted a played singles court, a walkover and a retirement without fabricated scores. Coordinator correction returned the card to editing; the corrected winner persisted after resubmission and reopening. Standings stayed empty while pending. Approval created one official result and two standings entries: Demo Aces 1–0 with courts 3–0 and 3 points; Demo Rally Crew 0–1 with 0 points. Results showed the official winner and Needs attention cleared. The synthetic result remains available for owner inspection. This demo exercises both roles on one account; separate captain/player device authorization is not established by it. No messages or captain reminders were sent. The minor practice-roster singular/plural issue is corrected in source for the next build.

Gboard displays its handwriting toolbar/floating input UI; score entry succeeded using the floating keyboard. A standard docked keyboard, enlarged text, separate captain/player device checks, physical-device checks, billing and notification acceptance remain pending. See `output/android-emulator-20261127/private-league-score-acceptance.json`, `signed-in-test-results.json`, `google-play-install-proof.json`, `google-play-payload-comparison.json` and `emulator-test-checkpoint.json` in the main checkout. An emulator install is not physical-device acceptance, and the independently compared distribution certificate is not an upload-certificate readback.

## Android activity notifications

The Android client supports opt-in FCM registration for coaching activity and hitting reminders, using the existing account, consent, mute, recipient and delivery checks. It creates a private Practice & coaching channel and keeps its secure installation state separate from iPhone. Sign-out requires confirmed server revocation. Existing APNs registrations keep their format; the private device ledger stores Android tokens with an explicit provider prefix and routes them through FCM. Delivery uses generic lock-screen text, bounded attempts and current eligibility. Account deletion retains its existing cascade. Released build 4 passed coaching delivery/tap and opt-out checks; build 5 passed the hitting-reminder handoff described above.

Migration `20261127000100_android_activity_push.sql` is installed in production. All six live audits passed: Apple purchases, Google purchases, Google notifications, account deletion, Android binding service-only permissions and Google checkout accounts disabled. Audit query: `https://supabase.com/dashboard/project/pwxppfazbyourjrsutgx/sql/42a6b751-5573-4f99-88cd-4a99b1801c61`.

The Firebase project is `tenaceiq-df2ac`, on the no-cost Spark plan. The production Android app is registered, Cloud Messaging v1 is enabled and Analytics is unlinked. The owner approved the separate Cloud Terms and a dedicated FCM-only sender. Its registered public certificate and protected local credential recovery were verified; Google issued a short-lived messaging authorization. `FIREBASE_PRIVATE_KEY` is a production-only Vercel Secret; `FIREBASE_PROJECT_ID` and `FIREBASE_CLIENT_EMAIL` are server configuration. `ANDROID_PUSH_ENABLED=true` now enables the approved opt-in delivery. No private key is bundled or committed.

For Android preparation, set `TIQ_ANDROID_GOOGLE_SERVICES_FILE` to the approved client `google-services.json`. Preparation validates the production package, app/project identity and client key, refuses a server service-account key, and preserves an already managed client file. The manifest disables Analytics collection and automatic messaging initialization; registration follows opt-in. Build 4 passed native release compilation and lint and the coaching background/tap checks described above. Use a separate generated project for debug builds: the production Firebase client does not match the `.dev` application ID.

T1 is also selected and saved under Google Play License testing with its existing two accounts. This is separate from internal-track assignment. Bank verification is complete. The existing verified TenAceIQ organization profile is selected in the Play merchant form, with website, software category, support email and statement name prepared; its final merchant-agreement submission still requires the owner. Google products, publisher access, purchase acceptance and lifecycle tests remain unfinished. Keep checkout inactive and preserve the current Apple review.

**The Google subscription-notification backend is deployed inactive.** PR #1874 passed all six CI checks in run `46081543447` and merged to production as `320c20b71c3109c81de814f6bddcacd43c4710e0`. Deployment `dpl_4bDuu2NQTpsQyZnMSQYHbe7Zvujw` is ready on the public aliases. The bounded live smoke returned the expected private/no-store `503 google_notification_unavailable` for notifications and `401 sign_in_required` for purchase access. The deployment's ten-minute warning/error log window was clear. No Google activation flag, publisher credential, Pub/Sub subscription or payment product was created. This verifies the inactive release, not real Google purchase or notification acceptance.

## Before Google Play testing and launch

### Current release checkpoint

The latest native client is **Android build 5**, **available to internal testers** on Google Play and installed on the Android 16 emulator. The verified TenAceIQ organization account owns the `com.tenaceiq.app` record. T1 is selected and saved with both owner-approved Google Accounts, and the internal track is active. Join through [the internal test link](https://play.google.com/apps/internaltest/4700840630274153323) using an approved account. Google temporarily displays `com.tenaceiq.app (unreviewed)` until app setup and review are complete; this is not a public release. The build 3 artifact and initial acceptance history below are retained as earlier evidence; use the latest release details at the top for build 5.

The uploaded AAB is `output/android-internal-3-20261127/TenAceIQ-Android-Internal-3.aab` in the main checkout. Strict signature verification passed and all 1,078 original payload files match the previously verified unsigned bundle. Google accepted version code 3, version name 1.0 and target SDK 36, with no blocking validation errors. Two diagnostics warnings remain: no deobfuscation file and no native debug symbols. Play App Signing is active. The real Google Play install, distribution certificate and signed-out Back/keyboard behavior are verified on the Android 16 emulator above. A physical install, billing acceptance and independent upload-certificate fingerprint readback have not been verified. The developer APK remains `com.tenaceiq.app.dev`. The current Apple submission is managed independently.

| Area | Verified evidence | Remaining work |
| --- | --- | --- |
| Shared app and Android Pro screen | Build 3 compiled and passed release lint; 88 Apple/Google phone browser checks passed; real Play install, native Back/keyboard, signed-in role navigation/forms, tactics full-screen and background/resume checked on Android 16 emulator | Completed write workflows, remaining platform checks and physical Android acceptance |
| Pro preparation and reconciliation API | Deployed with Google configuration absent; purchase-ledger migration installed November 27 | Configure Google and approve designated test accounts |
| Background Pro lifecycle | PR #1874 deployed inactive from `320c20b71c3109c81de814f6bddcacd43c4710e0`; all six CI gates, focused tests, production build and live guard checks passed; notification migration installed November 27 | Configure authenticated Pub/Sub and accept real delivery after merchant/product setup |
| League and tournament payments | Catalog, native purchase controller and canonical reader exist | Android event fulfillment and publication, including refund/revocation acceptance |
| Notifications, verified links and app lock | Shared routes and plugins exist | Android push delivery, final signing certificate/domain association, Android biometric implementation and device checks |
| Play Console and signing | Verified organization identity, website, phone and Trader status; `com.tenaceiq.app` created; Play App Signing active; internal build 3 available to T1 with two approved accounts | Physical install and acceptance, independent certificate readback and owner-controlled portable key backup |

Check the verification records under `output/google-membership-ui-20261123/`, `output/google-pro-notifications-20261123/`, `output/android-activation-20261127/` and `output/android-internal-3-20261127/` in the main checkout when preparing a release. The live November 27 audit passed Apple purchases, Google purchases, Google notifications, account deletion and disabled Google purchase-account access. Google checkout remains inactive. These records distinguish local/structural checks from real Google billing acceptance; a signed bundle does not satisfy the live gates.

Supabase displayed an organization usage-limit warning during the November 27 activation. The migration and audit queries succeeded. Review current measured usage before live Google testing and address the responsible workload before considering a paid capacity change.

### Immediate setup order

1. The organization account is verified and the app record exists. Use [the TenAceIQ dashboard](https://play.google.com/console/u/1/developers/4611911798113055787/app/4975741608213841355/app-dashboard). For another owner or app, complete the applicable identity, agreement and payment steps directly. Choose the account type that matches the actual owner; do not choose a different type to avoid testing requirements. See [Google's account setup guide](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en) and [account types](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en).
2. Both migrations are installed in TenAceIQ production and all five audit checks passed on November 27. For a fresh environment, verify the existing Apple/deletion audits, apply `20261123000100_google_pro_purchase_fulfillment.sql` followed by `20261123000200_google_pro_notifications.sql`, then recheck every audit. Keep Google checkout inactive during configuration.
3. Google accepted the signed `com.tenaceiq.app` bundle and Play App Signing is active. Independently compare Google's upload certificate with the prepared public certificate, and record every applicable distribution certificate before configuring verified links or services. Keep the protected upload key available for future releases. The `.dev` APK is for development and the older unsigned AAB remains an intermediate artifact.
4. Finish the prepared merchant agreement, then configure the monthly Pro product/base plan from the catalog below, publisher API access, authenticated Pub/Sub and designated license testers. The inactive backend is deployed; enable only the reviewed test configuration once the remaining setup is accepted. Real payment mode remains unavailable.
5. Build 5 is already rolled out to the internal track and T1 is assigned. Use the opt-in link above and verify a physical Android install. After billing configuration, accept Pro purchase, pending approval, restore, cancellation, renewal, hold/recovery and refund/revocation on an Android device. Use a Google Play test payment method. Internal testers and license testers are separate settings; an internal-test install alone does not prevent real charges. See [Google's billing test guide](https://developer.android.com/google/play/billing/test).
6. Complete the remaining app and store gates before a public Android release, including event purchases, push/deep links, permissions/accessibility, listing and Data safety declarations. For personal developer accounts created after November 13, 2023, Google requires at least 12 closed testers opted in continuously for at least 14 days before applying for production access. An internal test does not satisfy that closed-test requirement. Confirm the actual account's requirement in Play Console and [Google's testing policy](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

### Purchase implementation status

The approved catalog is below. These amounts configure the products; the app displays Google's verified localized price. Player remains free and Pro combines Captain and Coach tools.

| Product | Google product ID | US amount | Base plan / purchase option | Android activation |
| --- | --- | --- | --- | --- |
| Pro | `com.tenaceiq.app.pro.monthly` | $4.99/month | `monthly` | Pro license testing after setup and acceptance |
| Publish tournament | `com.tenaceiq.app.tournament.publish` | $5.00/event | `standard` | Keep unavailable until event fulfillment passes |
| Publish league | `com.tenaceiq.app.league.publish` | $25.00/season | `standard` | Keep unavailable until event fulfillment passes |

The Android project now includes Google Play Billing 9.1.0 through `TiqGooglePurchases`. Its product catalog is generated from the approved Pro and event prices. It selects the monthly Pro base plan (`monthly`) and single-event purchase options (`standard`) and returns Google's formatted price only when the product, USD amount and subscription period match. No fallback price is displayed.

The purchase controller supports cancellation, pending approval, automatic recovery on sign-in/resume, account switching, already acknowledged purchases and repeat delivery with the same operation ID. It requires authenticated server preparation and an exact account/event-bound durable delivery receipt. The native bridge has no acknowledgement or consumption method. These actions belong on the server after the entitlement is saved.

The server-side reader exchanges a scoped, short-lived service-account assertion with Google and checks the canonical `subscriptionsv2` or `productsv2` resource through fixed HTTPS endpoints. It validates the account binding, event-attempt binding, approved offer, region, quantity, test/production scope, refunds and current subscription state. Cancelled auto-renewal keeps its remaining paid period; on-hold, paused and expired states do not grant access. It returns verification evidence, not an entitlement grant.

Android account settings now mount a Pro membership panel with Google-verified pricing, purchase confirmation, pending approval, restore and subscription management. Its service stays alive when the panel closes, recovers on foreground for the current account and rejects late responses after account changes. The build resolves a separate membership boundary for each platform; iOS keeps the existing Apple implementation and excludes Google membership code. Android-only membership styles extend the shared navy, white and lime account theme.

Checkout remains **inactive until the server approves license testing**. The authenticated Pro preparation/reconciliation API is deployed with Google configuration absent. The private purchase and notification migrations were installed and audited on November 27. This rollout accepts only server-approved license-test accounts and test purchases. Production mode and league/tournament fulfillment remain unavailable. Authenticated real-time developer notifications are implemented locally and still require an endpoint deployment and Google configuration before use. Building or signing the client does not activate purchases.

### Upload signing and key custody

The prepared internal bundle is signed with the local `tenaceiq-upload` RSA-4096 key. The encrypted PKCS#12 keystore and Windows DPAPI-protected password are under `tmp/android-signing/` in the main checkout and excluded from Git. Only the public upload certificate is in `output/android-internal-3-20261127/`. Strict JAR verification, unchanged payload checks, public-certificate checks and password recovery under the Windows owner account passed.

The DPAPI password file depends on this Windows user profile; copying it to another account or CI runner is not a portable backup. Arrange an owner-controlled secure backup before moving signing to another computer or CI. Do not commit, attach to public artifacts or share the private keystore/password. Google accepted the signed bundle; an independent comparison of Google's upload-certificate fingerprint remains pending because the browser did not return its certificate download or clipboard value. This does not block the active internal track.

Google Play App Signing uses a separate distribution certificate. Use the final **Play app-signing certificate**, rather than assuming the local upload certificate, when configuring Android App Links and services that verify installed apps. See [Android's signing guide](https://developer.android.com/studio/publish/app-signing).

Server-only configuration for the reader is `GOOGLE_PLAY_ENABLED=true`, `GOOGLE_PLAY_PURCHASE_MODE=test|production`, `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` and secret `GOOGLE_PLAY_PRIVATE_KEY`. None belongs in a public environment variable, native bundle or committed environment file. This reader has no write operation and cannot settle or refund a purchase.

The `.dev` developer package cannot purchase production products. License testing needs the production package on the appropriate Google Play test track, matching signing configuration and configured products/base plan/purchase options. A passing emulator build does not establish Google sandbox billing acceptance.

### Pro fulfillment rollout

`supabase/migrations/20261123000100_google_pro_purchase_fulfillment.sql` creates `tenaceiq_google` with account bindings, a token-hash ledger and short-lived operation leases. Raw Google purchase tokens are not stored. All tables are private even to direct service-role queries; audited service-only RPCs perform writes. The migration preserves Apple's store-specific records, extends the existing self-only native RLS entry point, and adds Google's exact schema/cascade checks to the existing deletion audit without replacing its prior checks or function attributes.

`/api/mobile/google-purchases` authenticates every request. Preparation rechecks existing web, Apple and Google access before returning a stable account binding. Reconciliation verifies Google's current status, saves Pro access, acknowledges the subscription, then returns a settled receipt bound to the exact owner and token hash. An acknowledgment failure leaves a recoverable saved grant and blocks another purchase. Retries reverify current status, preserve known acknowledgment/replacement history and never replay a stale access decision. Inactive or refunded grants are closed without acknowledging a rejected payment.

Paused and on-hold subscriptions remove Pro access while blocking a second subscription through either native store. After verified expiry, a new purchase can be offered again. Production notifications are still required to keep those decisions current when the app is closed.

The API requires `GOOGLE_PLAY_FULFILLMENT_ENABLED=true`, `GOOGLE_PLAY_ENTITLEMENTS_ENABLED=true`, the reader's server-only credentials, and `GOOGLE_PLAY_PURCHASE_MODE=test`. The private account must also be approved for license testing. Production mode is rejected even if these flags are set. `GOOGLE_PLAY_ENTITLEMENTS_ENABLED` controls the combined access-reader rollout separately from checkout: once paid access is activated, keep it enabled when pausing new purchases.

Activation order: keep checkout inactive; verify existing Apple/deletion checks; apply the migration; configure Google products and license testers; approve only the designated test accounts; enable test flags; accept the native Pro checkout on the Play test track. The API may remain deployed with all Google flags absent while the migration is pending. Complete authenticated notifications, refund/revocation handling, event publication, deletion/billing disclosures and production eligibility before enabling real payments. Do not remove the new schema without a reviewed reverse migration: the deletion audit and native RLS entry point depend on it after installation.

The membership UI fixture uses the real client controller with synthetic Google responses and an isolated receipt service. Phone browser checks cover 320/390px layouts, enlarged text, missing prices, cancellation, pending approval, interrupted sync, restore with the same operation ID, existing access and closing during delivery. These are UI/controller checks, not real Google Play purchase acceptance.

### Subscription lifecycle notifications

The deployed `/api/google/notifications` endpoint accepts authenticated, wrapped Google Cloud Pub/Sub pushes when its reviewed test configuration is enabled. It verifies RS256 signatures against Google's fixed, cached public-key endpoint, the Google issuer, a fresh token, the exact audience, and the configured verified service-account email. It then requires the exact Pub/Sub subscription and production Android package. A separate activation flag keeps the endpoint inactive by default; production purchase mode remains rejected. Pausing new checkout does not disable lifecycle processing for existing test subscriptions.

Set `GOOGLE_PLAY_RTDN_ENABLED=true`, `GOOGLE_PLAY_RTDN_AUDIENCE=https://www.tenaceiq.com/api/google/notifications`, `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PLAY_RTDN_SUBSCRIPTION=projects/PROJECT_ID/subscriptions/SUBSCRIPTION_ID` only after reviewing the push subscription's OIDC identity and installing `supabase/migrations/20261123000200_google_pro_notifications.sql` after the purchase-ledger migration. Keep the existing Google reader and entitlement flags enabled. The push identity may be separate from the publisher API reader. Never place service credentials in the native app.

Notification types trigger a current canonical purchase check; they do not directly grant or revoke access. Known purchases reuse their existing binding. A first approval while the app is closed discovers its binding only from Google's resource, resolves an already approved account, and reverifies under the shared purchase lease. Unknown, disabled or deleted accounts are never recreated. Paid cancelled periods remain available; on-hold, paused, expired and revoked purchases follow the canonical access decision. A refund for an older renewal does not by itself remove a later valid paid period.

`tenaceiq_google_notifications` stores only message/content/token hashes, owner binding, leases and completion metadata. Its service-only RPCs suppress completed duplicate deliveries, reject mutated message IDs, and retain one recovery operation after interruptions. A delivery becomes complete only after the purchase is saved and settled. The new schema has its own exact privacy/cascade audit and extends the existing deletion audit without changing Apple's or Google's purchase catalogs. Completed receipts are cleaned in bounded batches after 30 days. Raw purchase tokens, authorization JWTs and message bodies are not persisted or logged.

Configure wrapped push delivery with retries and a dead-letter policy in Google Cloud before acceptance testing. Invalid identities receive 401; malformed payloads receive 400; transient key/provider/database/lease failures receive 503 so Pub/Sub can retry. Authenticated console test messages and unsupported one-time/refund-review workflows are acknowledged without touching entitlements. Test the actual Pub/Sub identity, duplicate/redelivery behavior, first approval, renewal, hold/recovery, cancellation and refund/revocation before enabling paid Android access. Local signature and database tests do not establish live delivery acceptance. See [Google push authentication](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions) and [the notification reference](https://developer.android.com/google/play/billing/rtdn-reference).

A test-track install alone does not prevent real charges. Confirm the Google Account is configured as a license tester and select a Google Play test payment method before confirming a purchase. The UI describes test access without promising a free payment. See [Google's billing testing guide](https://developer.android.com/google/play/billing/test).

### Remaining launch gates

1. Accept a physical install from the active internal track and complete certificate readback and portable upload-key custody. The organization account is verified, the production package exists, Play App Signing is active and build 5 is available to the assigned T1 group. None of those console checks establishes physical-device acceptance or public-release readiness.
2. Accept the implemented Google Pro purchase, restore and lifecycle flows on the real Play test track. Finish Android league/tournament fulfillment and publication, including pending/cancelled purchases, canonical verification and refund/revocation handling. Keep Android payments unavailable until each applicable flow passes.
3. Finish physical-device notification and lock-screen acceptance. Coaching and hitting-reminder delivery/tap passed on the emulator; this does not establish complete Android notification parity. First-party team-message notifications are not added by this release.
4. Verify Android link ownership with the final signing certificates and a production `assetlinks.json`. The manifest contains supported HTTPS routes, but verified App Links are not yet established. Test account recovery and invitation handoffs on a device.
5. Complete Android permissions, keyboard/Back behavior, edge-to-edge layouts, background/resume, offline/session storage, media selection, sharing, location/maps and accessibility testing. Android biometric locking needs a separate implementation; the present app-lock bridge is iOS-specific.
6. Prepare the Google Play listing and screenshots from the tested Android app, reviewer access, Data safety, privacy and content declarations. Complete the account's required test track before applying for production access.

The initial Android developer build is a platform foundation. Shared screens and backend access do not establish purchase, push, biometric or verified-link parity. Keep the current Apple review moving independently.
