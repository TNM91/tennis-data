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

Checkout is **not mounted in the app**. The authenticated fulfillment endpoints, separate Google purchase ledger, entitlement integration, server acknowledgement/consumption, refund handling and authenticated real-time developer notifications still need to be completed before activation. No schema, production environment or Apple purchase behavior was changed in this pass. This deliberately leaves purchases inactive until fulfillment is complete; providing credentials alone must not enable checkout.

Server-only configuration for the reader is `GOOGLE_PLAY_ENABLED=true`, `GOOGLE_PLAY_PURCHASE_MODE=test|production`, `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` and secret `GOOGLE_PLAY_PRIVATE_KEY`. None belongs in a public environment variable, native bundle or committed environment file. This reader has no write operation and cannot settle or refund a purchase.

The `.dev` developer package cannot purchase production products. License testing needs the production package on the appropriate Google Play test track, matching signing configuration and configured products/base plan/purchase options. A passing emulator build does not establish Google sandbox billing acceptance.

### Remaining launch gates

1. Confirm the owner's Play Console account and business identity, reserve the production package, and set up protected signing and Play App Signing. The local release bundle is unsigned and no Play upload is configured.
2. Implement and verify Google Play billing for Pro and event purchases, including pending/cancelled purchases, server verification, restore/reconciliation and existing subscriber access. The current Apple purchase bridge is iOS-specific. Do not advertise working Android purchases until that flow passes.
3. Add the Android push configuration and notification channels, runtime permission, token registration, delivery and notification navigation. Having the Capacitor push plugin installed does not establish working Android notifications.
4. Verify Android link ownership with the final signing certificates and a production `assetlinks.json`. The manifest contains supported HTTPS routes, but verified App Links are not yet established. Test account recovery and invitation handoffs on a device.
5. Complete Android permissions, keyboard/Back behavior, edge-to-edge layouts, background/resume, offline/session storage, media selection, sharing, location/maps and accessibility testing. Android biometric locking needs a separate implementation; the present app-lock bridge is iOS-specific.
6. Prepare the Google Play listing and screenshots from the tested Android app, reviewer access, Data safety, privacy and content declarations. Complete the account's required test track before applying for production access.

The initial Android developer build is a platform foundation. Shared screens and backend access do not establish purchase, push, biometric or verified-link parity. Keep the current Apple review moving independently.
