# Android activity notifications

Android notifications share the existing first-party coaching and hitting reminder workflows. The dispatcher keeps APNs and FCM tokens separate; existing iPhone registration and delivery stay on APNs. This release does not add Android team-message notifications or enable Google Play payments.

## Server activation

Apply `20261127000100_android_activity_push.sql` after the existing native coaching migrations. It extends the private device-token constraint and adds a service-role-only binding wrapper. Installation secrets, owner checks, revocation, opt-in and profile-deletion cascades continue through the existing functions. No device tokens become publicly readable.

Production requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, the RSA `FIREBASE_PRIVATE_KEY` as a server-only Vercel Secret, and `ANDROID_PUSH_ENABLED=true`. Preview deployments reject Android sending. Keep the activation flag false until the client and live delivery checks are ready. Never put the sender key in Git, native assets or logs. Use the dedicated project-scoped Firebase Cloud Messaging API Admin identity, not an owner credential.

Registration requires a remotely verified TenAceIQ bearer account and a device installation secret. FCM tokens remain case-sensitive and use an `fcm:` prefix only in private storage. Account revocation works even when delivery is disabled. Coaching availability uses the native platform header; an Android outage does not change the existing iPhone capability response.

## Delivery and acceptance

Only generic text and an account-bound destination are sent. The Android channel is private. Existing transactional eligibility, preferences and receipts determine which devices can receive an event. Only an explicit FCM `UNREGISTERED` response expires a token; authorization, quota and temporary provider errors do not delete registrations. Provider calls, response sizes, batch size and concurrency are bounded.

Before marking Android notification acceptance complete, install the signed release through the Play test track, opt in on that device, and use a synthetic coaching or hitting fixture addressed only to the test account. Verify background delivery, lock-screen privacy, correct tap destination, account isolation and revocation. OAuth authorization and local tests alone do not establish device delivery.

The reviewed activation is independent of the current App Store submission. Do not replace or withdraw that submission for an Android release.
