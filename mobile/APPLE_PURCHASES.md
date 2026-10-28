# Apple purchases: first U.S. launch

The approved first launch offers Player ($1.99/month) and Captain ($4.99/month, including Player). Both belong to **TenAceIQ Memberships**, group `22523692`. Existing website members keep their access. No Coach, Full-Court, Family Sharing, multiseat, international or season product is offered by this candidate.

| Product | Apple ID | Level | Period |
| --- | --- | --- | --- |
| `com.tenaceiq.app.player.monthly` | 6828145101 | 2 | ONE_MONTH |
| `com.tenaceiq.app.captain.monthly` | 6828144041 | 1 | ONE_MONTH |

The draft products have their exact U.S. prices, English metadata and USA-only availability, with future territories disabled. They remain unsubmitted and missing review metadata. Reuse these products. Customer prices always come from StoreKit; catalog prices are setup checks only.

The app is the final product. The current HTTPS host remains the shared backend during and after the public website transition; see [product direction](PRODUCT_DIRECTION.md). No website shutdown or redirect is part of this purchase candidate.

## Candidate behavior

Account settings offers purchase, explicit Restore purchases, Sync purchase and Apple subscription management. StoreKit 2 verifies native transactions and the app's signed environment before opening a purchase sheet. Purchases require iOS 16 or later and a USA storefront. The app remains otherwise usable on its existing supported iOS versions. A matching existing Apple entitlement directs the member to restore/manage rather than starting another purchase. Existing web access suppresses the Subscribe controls.

A server-issued UUID binds each purchase to the signed-in TenAceIQ account. Native transactions remain unfinished until the server durably acknowledges that exact transaction and token. Interrupted delivery is recovered at app launch, account change, foreground or a StoreKit update; there is no billing poll or automatic Apple sign-in prompt. Only the explicit Restore button calls `AppStore.sync()`. Cancel and pending outcomes do not grant access. A failed sync disables another Subscribe action until Sync/Restore succeeds.

The server verifies Apple's signed transaction with the official Apple library, pinned public G2/G3 roots and online certificate checks. It validates bundle `com.tenaceiq.app`, app `6826324431`, group, exact product, environment, account token, purchased ownership and USA storefront, then fetches and verifies **current subscription status** from Apple. The submitted receipt alone cannot unlock tools. Only active, unexpired, unrevoked, non-upgraded membership grants access; billing grace is not supported by this launch candidate.

Server API transport is GET-only to Apple's fixed subscription-status host, rejects redirects, limits the response to 256 KiB and times out after ten seconds. Certificate checks have the SDK's thirty-second limit; routes have a sixty-second budget. The native reconciliation request waits up to fifty-five seconds and retains unfinished deliveries on failure.

Signed V2 notifications use `/api/apple/notifications/production` and `/api/apple/notifications/sandbox`. Both verify the outer signature/environment and inner transaction, then use the same fresh-status commit path. Unknown/deleted/unbound accounts are acknowledged without recreation. Client operation claims have a twelve-per-fifteen-minute quota; verified notifications have a separate lane. Durable receipts, leases, account locks, original-transaction ownership and monotonic signed dates prevent duplicate grants and stale refund replay.

## Database and access

Three **unapplied** migrations accompany this candidate:

- `20261028000300_apple_purchase_records.sql`: three RLS-protected private tables, service-only account/claim/commit/access functions, one authenticated own-account access read and an exact catalog guard. No anonymous/authenticated raw-table access. Sandbox grants require an explicit per-account allowlist.
- `20261028000400_apple_purchase_erasure_guard.sql`: retains the entire existing audited erasure guard and adds the private purchase catalog guard. All private owner records cascade only with their Auth account. An unexpected private column, FK, grant or deletion trigger blocks automated erasure.
- `20261028000500_apple_paid_tool_access.sql`: adds caller-owned Apple Player access to the existing storage helper and Apple Captain access to owned named-lineup writes. Existing web/admin rules and shared legacy visibility are preserved. Preflight hashes reject an unexpected deployed definition.

Apple access is merged additively at `/api/auth/access` and paid server authorizers. Browser fallback reads this authenticated endpoint rather than raw profile flags. Apple events never overwrite Stripe-owned profile grants, roles or billing IDs. An Apple refund cannot remove a valid website grant. Account deletion still discloses that the member must cancel an Apple subscription in Apple settings; deletion does not cancel Apple billing or issue a refund.

## Activation gates — off by default

Local tests and a simulator build cannot prove a real purchase. Do not enable public sales or submit this dormant flow for public review.

1. Obtain separate approval for the exact production migrations and a **new In-App Purchase key**. The existing Developer-role TestFlight upload key must not be reused or expanded. Create/download the IAP key in App Store Connect only after approval, keep its private material out of Git, screenshots and logs, and store it only in the approved Vercel server-secret destination.
2. Apply migrations in order after required CI passes. Verify both catalog functions and the deployed access definitions/privileges. Never change the guard to accept drift. Confirm the existing private namespace is unused before migration.
3. Configure encrypted **server-only production** values `APPLE_IAP_PRIVATE_KEY`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`. Never use a `NEXT_PUBLIC_` name. Set `APPLE_MEMBERSHIPS_ENABLED=true` and **`APPLE_PURCHASE_MODE=sandbox`** only for the approved sandbox phase. Do not enable these values in arbitrary previews.
4. Create a dedicated disposable account; do not use the owner's real member account. Server-create its purchase-account token, then allowlist only that UUID with `sandbox_enabled=true`. The sandbox mode returns disabled for every other member. An environment mismatch stops the native purchase before an Apple payment sheet can appear.
5. Configure the exact HTTPS production/sandbox V2 notification endpoints in Apple's app settings. Request Apple's test notification and confirm signed verification. Keep billing grace off. Review Streamlined Purchasing before launch: unbound purchases cannot attach to an account in this candidate.
6. Release a verified signed TestFlight candidate under standing beta approval, then perform the physical-iPhone sandbox matrix below. Do not claim the flow works on a device until those cases are observed.
7. Only after acceptance, complete subscription screenshots/review instructions, app privacy, age rating, review credentials, support/legal links and the app version's first-subscription association. Confirm Paid Apps, banking and tax status directly in Apple. Document/enable the real review flow before public review; public submission and live-sale mode require their own authorization.

For a new-sale pause, set `APPLE_PURCHASE_MODE=off` while retaining the enabled access/verification configuration. This keeps existing access, restore, notifications and reconciliation available. Do not turn off all Apple access as a sales rollback after members have purchased.

## Dependency checks

The purchase candidate pins the official Apple server library to 3.1.0 and its bounded HTTP transport to node-fetch 2.7.0. The dependency audit also identified existing critical framework advisories; this candidate updates Next.js from 16.3.0 to 16.4.3 and sharp from 0.35.3 to 0.35.5. The existing ESLint configuration and locked Hooks plugin 7.0.1 are retained; no lint rules are disabled. The newer lint toolchain introduces a separate React cleanup across existing screens and is outside this purchase candidate. Verify the updated production bundle rather than treating a lockfile update as proof of compatibility. See the [Next.js upstream typed-array advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) and [image-library advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw).

## Physical-iPhone sandbox acceptance

- Correct StoreKit monthly prices, expected Apple sandbox sheet and USA storefront; a non-allowlisted account has no purchase controls.
- Player purchase unlocks My Lab/follows/matchups; Captain also unlocks owned lineup save/update. Player cannot save a Captain lineup; another account cannot read/write it.
- Cancel and Ask to Buy/pending grant nothing. Approved transactions recover without an automatic sign-in prompt.
- Interrupt network/server delivery after Apple success; restart app, sync and restore without a second purchase. A server failure never finishes an unacknowledged transaction.
- Restore after reinstall; account switch before/after Apple response; wrong account token; expired, renewal, upgrade/downgrade via Apple management and refunded/revoked status. Current Apple server status must drive access.
- Renewal/expiry/refund notifications are signed, owner-bound and idempotent. Duplicate or out-of-order notifications do not resurrect refunded access.
- A website member is not offered a duplicate Apple purchase and retains existing access after Apple expiry/refund.
- Automated erasure removes only the dedicated account and its private Apple records, preserves others' team data, and does not recreate the account on a later notification. Sandbox allowlisting is removed after testing.

Sources: [Apple subscription groups and levels](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/), [StoreKit transaction updates](https://developer.apple.com/documentation/storekit/transaction/updates), [Restore with AppStore.sync](https://developer.apple.com/documentation/storekit/appstore/sync()), [Apple server verification library](https://github.com/apple/app-store-server-library-node), [In-App Purchase API keys](https://developer.apple.com/documentation/appstoreserverapi/creating-api-keys-to-authorize-api-requests), [App Review subscriptions](https://developer.apple.com/app-store/review/guidelines/#subscriptions).
