# Google Pro backend rollout

This release prepares test-only Google Pro fulfillment. Player stays free; Pro includes Captain and Coach at $4.99/month. Android league and tournament publication payments are not enabled by this API.

## Inactive deployment

The API can be deployed with all Google flags absent or set to `false`. Every request is authenticated before readiness is returned. Inactive checkout does not call the new Google database functions, change Apple purchase processing, or alter existing subscription records. Keep the current Apple submission and native purchase screens unchanged during this release.

Before enabling any Google flag, apply `supabase/migrations/20261123000100_google_pro_purchase_fulfillment.sql` to the approved Supabase project. The transaction verifies the existing Apple and deletion audits first and rolls back if its prerequisites or final checks fail. It creates a separate private Google namespace, preserves the existing deletion checks, and updates the self-only native entitlement reader used by existing database policies.

After applying it, all three service-only checks must return `true`:

```sql
select public.apple_purchase_catalog_ready() as apple_ready,
       public.google_purchase_catalog_ready() as google_ready,
       public.account_erasure_catalog_ready() as deletion_ready;
```

Confirm that the Google ledger starts empty, direct table access is denied to application roles, and the pre-existing Apple store-specific access reader still returns its original fields. Do not create or enable production Google accounts in this rollout.

## License-test activation

Configure the production Android package, protected signing, the Google Play test track, license testers and the approved `com.tenaceiq.app.pro.monthly` subscription with base plan `monthly`. The developer `.dev` package cannot purchase production-package products.

Configure server-only credentials directly in the deployment provider. Never put a service-account private key in a public variable, native asset or committed file. Required settings are:

- `GOOGLE_PLAY_ENABLED=true`
- `GOOGLE_PLAY_PURCHASE_MODE=test`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PLAY_PRIVATE_KEY` as a secret
- `GOOGLE_PLAY_FULFILLMENT_ENABLED=true`
- `GOOGLE_PLAY_ENTITLEMENTS_ENABLED=true`

Only explicitly approved test accounts may have `tenaceiq_google.accounts.test_enabled=true`. The API rejects production mode even when the flags are enabled. Enabling entitlements and enabling new checkout are separate decisions: keep the entitlement reader enabled once paid access is activated, including when pausing new purchases.

Verify purchase, cancellation, pending payment, acknowledgment interruption, app restart, restore, account switching, expiration, pause/on-hold, existing Apple/web access, and access to both Captain and Coach. Save verified access before Google acknowledgment. A retry must reverify current status and keep one account-bound purchase row.

Complete authenticated real-time notifications, refund/revocation handling and deletion/billing disclosures before accepting real payments. Event publication fulfillment remains a separate requirement. Do not remove the Google schema after installation without a reviewed reverse migration; native access and the deletion audit depend on it.

## Verification and release

Run the focused Google/Apple payment tests, then the repository's full release checks on this production-based branch. Required GitHub gates are `Verify` and `TIQ Schema Audit`. Use the existing Git deployment from `master` after confirming the project and current production branch. Avoid a separate manual production deployment.

After release, run one bounded API smoke and inspect a short error-log window. An unauthenticated GET or POST to `/api/mobile/google-purchases` must return `401` with `Cache-Control: private, no-store`. An authenticated request with Google checkout inactive must return `enabled:false` without exposing credentials or purchase records. These checks establish deployment readiness, not Google license-purchase acceptance.
