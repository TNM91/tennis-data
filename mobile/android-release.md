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

1. Confirm the owner's Play Console account and business identity, reserve the production package, and set up protected signing and Play App Signing. The local release bundle is unsigned and no Play upload is configured.
2. Implement and verify Google Play billing for Pro and event purchases, including pending/cancelled purchases, server verification, restore/reconciliation and existing subscriber access. The current Apple purchase bridge is iOS-specific. Do not advertise working Android purchases until that flow passes.
3. Add the Android push configuration and notification channels, runtime permission, token registration, delivery and notification navigation. Having the Capacitor push plugin installed does not establish working Android notifications.
4. Verify Android link ownership with the final signing certificates and a production `assetlinks.json`. The manifest contains supported HTTPS routes, but verified App Links are not yet established. Test account recovery and invitation handoffs on a device.
5. Complete Android permissions, keyboard/Back behavior, edge-to-edge layouts, background/resume, offline/session storage, media selection, sharing, location/maps and accessibility testing. Android biometric locking needs a separate implementation; the present app-lock bridge is iOS-specific.
6. Prepare the Google Play listing and screenshots from the tested Android app, reviewer access, Data safety, privacy and content declarations. Complete the account's required test track before applying for production access.

The initial Android developer build is a platform foundation. Shared screens and backend access do not establish purchase, push, biometric or verified-link parity. Keep the current Apple review moving independently.
