# iPhone subscription implementation — U.S. first

The owner selected the United States for the first public App Store launch on October 28, 2026. This is a launch-market decision, not authorization to submit the app, accept a paid agreement, change prices, or start a subscription.

The app has email accounts, automatic deletion and existing web billing management. It does **not** yet implement Apple purchasing or restore. The privacy candidate adds no purchasing button and does not change checkout activation.

## Proposed catalog

Use the existing product/tier language and customer prices from `lib/product-story.ts` and `lib/pricing-plans.ts`. These are proposed App Store equivalents, not configured Apple products:

| Plan | Existing USD monthly price | Apple subscription level |
| --- | ---: | --- |
| Full-Court | $9.99 | 1 |
| Coach | $4.99 | 2 |
| Captain | $4.99 | 2 |
| Player | $1.99 | 3 |

One subscription group avoids simultaneous Apple subscriptions to overlapping plans. Coach and Captain have different access at the same level; the purchase screen must explain a crossgrade's access changes. Full-Court includes both. Do not invent annual plans, trial offers, Family Sharing, higher prices, or organization/season products in the first implementation. App Store display prices must come from StoreKit's localized product response rather than a hard-coded dollar string.

Apple's U.S. exception permits external purchase links without the external-link entitlement. The baseline digital-feature and multiplatform IAP requirements still need to be addressed; a Stripe portal alone is not proof of a complete purchasing implementation or review acceptance.

## Implementation boundary

1. Build a local StoreKit 2 bridge for product loading, explicit purchase, current entitlements, transaction updates, restore and Apple subscription management. Bind purchases to the authenticated TenAceIQ account with `appAccountToken`. Never start a purchase or restore on entry, resume or refresh.
2. Verify Apple's signed data on the server with Apple's supported verification library, trusted root certificates, exact bundle/app IDs, product allowlist and explicit environment. Reconcile current subscription state rather than treating an old signed transaction as a current entitlement. Reject wrong-account, wrong-app, unsupported-product and revoked/expired transactions. Do not finish a transaction until the server has durably accepted it; retry the same transaction without another charge.
3. Record Apple, Stripe and manual/granted access separately and derive effective access from their union. An Apple refund must not erase a valid web membership; a Stripe cancellation must not overwrite valid Apple access. Existing profile flags and RLS are shared by many tools, so updating them without source provenance is unsafe. Audit every writer before changing this boundary.
4. Keep Sandbox/TestFlight transactions separate from production purchases. A sandbox receipt must never grant paid production website/profile access. Verify sandbox purchase/restore/provider events with a controlled test identity; test production projection rules locally. Do not charge an existing member to simulate testing.
5. Process verified App Store server notifications idempotently. Handle renewal, expiry, cancellation, refund/revocation, grace/billing retry and out-of-order events. A webhook cannot recreate an erased account. Restore cannot move another member's purchase to the current account by guessing an email or trusting a client flag.
6. Extend the account-erasure audit, catalog guard and cleanup for every new table/reference. Apple subscriptions require user cancellation through Apple; account deletion cannot silently claim to cancel them through Stripe. Keep only justified minimal audit/tombstone data and explain its retention.
7. Show purchase terms, interval, localized price, Terms, Privacy, Restore purchases and Manage subscription. Suppress duplicate purchasing when an existing membership already covers access. Resume into one bounded server access refresh; do not poll for payment success or trust a return-URL parameter.

## External setup and verification gates

- Check the Paid Applications agreement and the owner's banking/tax setup in App Store Connect. The owner completes legal acceptance and sensitive financial entry; do not accept or enter these on their behalf.
- Review the exact Apple subscription group/products/prices and required server-key scope before creating persistent credentials or changing production permissions.
- Complete local unit/SQL/native checks, verified sandbox transactions/notifications, physical iPhone restore/account-switch tests, and a final catalog/policy review before enabling purchasing.
- Reuse the normal protected beta pipeline. Public App Store submission and new tester invitations remain separate approvals. Do not create paid staging infrastructure as a routine test step.

References checked October 28, 2026: [App Review payments](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), [StoreKit](https://developer.apple.com/storekit/), [App Store Server Library](https://developer.apple.com/documentation/appstoreserverapi/simplifying-your-implementation-by-using-the-app-store-server-library).
