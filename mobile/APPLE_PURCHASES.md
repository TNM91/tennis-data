# Apple purchases: first launch

The owner selected Player and Captain for the first U.S. App Store launch on October 28, 2026. The catalog source is `lib/apple-membership-products.ts`; intended U.S. prices come from the existing website pricing model.

| Apple product | Access | U.S. monthly price | Group level |
| --- | --- | --- | --- |
| `com.tenaceiq.app.player.monthly` | Player | $1.99 | 2 |
| `com.tenaceiq.app.captain.monthly` | Captain, including Player | $4.99 | 1 |

Use one group, **TenAceIQ Memberships**, with U.S.-only availability, no automatic new territories, and no Family Sharing or multiseat purchases. Coach, Full-Court, Club and season purchases are outside this first Apple catalog. Existing account access remains authoritative regardless of these launch products.

The draft group and both products have been created in App Store Connect. Read-back checks confirm the exact monthly prices, levels, English metadata, U.S.-only availability and individual App Store purchases. Both products remain unsubmitted with missing review metadata; no customer purchase controls are enabled.

## Current implementation

- Account settings can read the existing authenticated `/api/auth/access` response and show currently available Player, Coach, Captain and League tools. It uses the website's role, inheritance and expiry calculation. This is a tools summary, not a billing statement or proof of purchase.
- Loading, unavailable and expired access do not become a default paid or Free subscription claim. Refresh is explicit; there is no background billing polling or cached cross-account response.
- Native requests are pinned to the existing HTTPS endpoint, bounded to twelve seconds, and discarded after an account switch, closed account sheet or replaced pane.
- The product catalog is preparation for Apple setup. Creating a catalog or displaying account tools does not implement or enable buying, restoring, or Apple entitlements.

## Required before purchase controls ship

1. Reuse the existing draft group and exact products; do not create replacement product IDs. Complete review screenshots and purchase instructions after the purchase flow is implemented. StoreKit must supply the displayed localized price.
2. Add StoreKit 2 product loading, explicit purchase/restore actions, verified transaction observation and recoverable unfinished transactions. Call `AppStore.sync()` only after the user chooses Restore.
3. Bind purchases to a server-issued account token. Verify Apple's signed transaction, bundle, product, environment, account binding, expiry and revocation on the server. A client product ID, decoded unsigned payload or local display state cannot grant access.
4. Keep Apple records separate from existing web billing. Renewal, cancellation, refund and replay handling must not overwrite a valid web or administrative grant. An existing web member must not be directed into a second overlapping purchase.
5. Decide sandbox isolation and reviewer/test-account access before enabling sandbox reconciliation against production data. Add verified server notifications and idempotent transaction processing. New production tables or permission changes require their own reviewed migration approval.
6. Verify buy, canceled/pending buy, restore, account switch, renewal/expiry/refund and interrupted delivery on an iPhone. Confirm the Paid Apps Agreement, banking and tax requirements are complete directly in Apple before sale.

The first subscriptions must accompany a new app version when submitted for App Review. Public submission and live sales remain separate from internal beta approval.

Sources: [Apple subscription groups and levels](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/), [StoreKit current entitlements](https://developer.apple.com/documentation/storekit/transaction/currententitlements), [Restore with AppStore.sync](https://developer.apple.com/documentation/storekit/appstore/sync()), [Apple server verification library](https://github.com/apple/app-store-server-library-node).
