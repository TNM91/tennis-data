# Android release preparation

The Android lane packages the full first-party TenAceIQ app, starting from the TestFlight 353 source. It does not revive the older server-loaded prototype or change the Apple submission. External data imports remain excluded.

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

## Before Google Play testing and launch

### Purchase implementation status

The Android project now includes Google Play Billing 9.1.0 through `TiqGooglePurchases`. Its product catalog is generated from the approved Pro and event prices. It selects the monthly Pro base plan (`monthly`) and single-event purchase options (`standard`) and returns Google's formatted price only when the product, USD amount and subscription period match. No fallback price is displayed.

The purchase controller supports cancellation, pending approval, automatic recovery on sign-in/resume, account switching, already acknowledged purchases and repeat delivery with the same operation ID. It requires authenticated server preparation and an exact account/event-bound durable delivery receipt. The native bridge has no acknowledgement or consumption method. These actions belong on the server after the entitlement is saved.

The server-side reader exchanges a scoped, short-lived service-account assertion with Google and checks the canonical `subscriptionsv2` or `productsv2` resource through fixed HTTPS endpoints. It validates the account binding, event-attempt binding, approved offer, region, quantity, test/production scope, refunds and current subscription state. Cancelled auto-renewal keeps its remaining paid period; on-hold, paused and expired states do not grant access. It returns verification evidence, not an entitlement grant.

Android account settings now mount a Pro membership panel with Google-verified pricing, purchase confirmation, pending approval, restore and subscription management. Its service stays alive when the panel closes, recovers on foreground for the current account and rejects late responses after account changes. The build resolves a separate membership boundary for each platform; iOS keeps the existing Apple implementation and excludes Google membership code. Android-only membership styles extend the shared navy, white and lime account theme.

Checkout remains **inactive until the server approves license testing**. The authenticated Pro preparation/reconciliation API is deployed with Google configuration absent. Its private ledger migration still needs installation before activation. This rollout accepts only server-approved license-test accounts and test purchases. Production mode and league/tournament fulfillment remain unavailable. Authenticated real-time developer notifications are implemented locally and require their own migration, deployment and Google configuration before use. No production schema or environment is changed by building the client.

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

The local `/api/google/notifications` endpoint accepts authenticated, wrapped Google Cloud Pub/Sub pushes. It verifies RS256 signatures against Google's fixed, cached public-key endpoint, the Google issuer, a fresh token, the exact audience, and the configured verified service-account email. It then requires the exact Pub/Sub subscription and production Android package. A separate activation flag keeps the endpoint inactive by default; production purchase mode remains rejected. Pausing new checkout does not disable lifecycle processing for existing test subscriptions.

Set `GOOGLE_PLAY_RTDN_ENABLED=true`, `GOOGLE_PLAY_RTDN_AUDIENCE=https://www.tenaceiq.com/api/google/notifications`, `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PLAY_RTDN_SUBSCRIPTION=projects/PROJECT_ID/subscriptions/SUBSCRIPTION_ID` only after reviewing the push subscription's OIDC identity and installing `supabase/migrations/20261123000200_google_pro_notifications.sql` after the purchase-ledger migration. Keep the existing Google reader and entitlement flags enabled. The push identity may be separate from the publisher API reader. Never place service credentials in the native app.

Notification types trigger a current canonical purchase check; they do not directly grant or revoke access. Known purchases reuse their existing binding. A first approval while the app is closed discovers its binding only from Google's resource, resolves an already approved account, and reverifies under the shared purchase lease. Unknown, disabled or deleted accounts are never recreated. Paid cancelled periods remain available; on-hold, paused, expired and revoked purchases follow the canonical access decision. A refund for an older renewal does not by itself remove a later valid paid period.

`tenaceiq_google_notifications` stores only message/content/token hashes, owner binding, leases and completion metadata. Its service-only RPCs suppress completed duplicate deliveries, reject mutated message IDs, and retain one recovery operation after interruptions. A delivery becomes complete only after the purchase is saved and settled. The new schema has its own exact privacy/cascade audit and extends the existing deletion audit without changing Apple's or Google's purchase catalogs. Completed receipts are cleaned in bounded batches after 30 days. Raw purchase tokens, authorization JWTs and message bodies are not persisted or logged.

Configure wrapped push delivery with retries and a dead-letter policy in Google Cloud before acceptance testing. Invalid identities receive 401; malformed payloads receive 400; transient key/provider/database/lease failures receive 503 so Pub/Sub can retry. Authenticated console test messages and unsupported one-time/refund-review workflows are acknowledged without touching entitlements. Test the actual Pub/Sub identity, duplicate/redelivery behavior, first approval, renewal, hold/recovery, cancellation and refund/revocation before enabling paid Android access. Local signature and database tests do not establish live delivery acceptance. See [Google push authentication](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions) and [the notification reference](https://developer.android.com/google/play/billing/rtdn-reference).

A test-track install alone does not prevent real charges. Confirm the Google Account is configured as a license tester and select a Google Play test payment method before confirming a purchase. The UI describes test access without promising a free payment. See [Google's billing testing guide](https://developer.android.com/google/play/billing/test).

### Remaining launch gates

1. Confirm the owner's Play Console account and business identity, reserve the production package, and set up protected signing and Play App Signing. The local release bundle is unsigned and no Play upload is configured.
2. Implement and verify Google Play billing for Pro and event purchases, including pending/cancelled purchases, server verification, restore/reconciliation and existing subscriber access. The current Apple purchase bridge is iOS-specific. Do not advertise working Android purchases until that flow passes.
3. Add the Android push configuration and notification channels, runtime permission, token registration, delivery and notification navigation. Having the Capacitor push plugin installed does not establish working Android notifications.
4. Verify Android link ownership with the final signing certificates and a production `assetlinks.json`. The manifest contains supported HTTPS routes, but verified App Links are not yet established. Test account recovery and invitation handoffs on a device.
5. Complete Android permissions, keyboard/Back behavior, edge-to-edge layouts, background/resume, offline/session storage, media selection, sharing, location/maps and accessibility testing. Android biometric locking needs a separate implementation; the present app-lock bridge is iOS-specific.
6. Prepare the Google Play listing and screenshots from the tested Android app, reviewer access, Data safety, privacy and content declarations. Complete the account's required test track before applying for production access.

The initial Android developer build is a platform foundation. Shared screens and backend access do not establish purchase, push, biometric or verified-link parity. Keep the current Apple review moving independently.
