# Stripe subscription lifecycle QA

Use this checklist after billing changes, Stripe webhook configuration changes, or plan access changes.

## Safety checks

- Confirm the Stripe Dashboard is in test mode before creating or mutating test subscriptions.
- Confirm the local or deployed app points at test credentials before sending test events. Do not create, cancel, or force-fail live customer subscriptions for QA.
- Keep the canonical production webhook endpoint as `https://www.tenaceiq.com/api/stripe/webhook`.
- Keep these webhook events enabled: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed`.
- Keep all paid checkout price env vars configured anywhere checkout can run: `STRIPE_PLAYER_PRICE_ID`, `STRIPE_COACH_PRICE_ID`, `STRIPE_CAPTAIN_PRICE_ID`, `STRIPE_LEAGUE_PRICE_ID`, and `STRIPE_FULL_COURT_PRICE_ID`.

## Live-mode go-live gate

Do not open paid launch until Stripe mode is intentionally switched and verified.

1. Create or confirm live-mode Stripe Products and Prices for Player, Coach, Captain, League, and Full-Court.
2. Replace Production Vercel Stripe env vars with live-mode values:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PLAYER_PRICE_ID`
   - `STRIPE_COACH_PRICE_ID`
   - `STRIPE_CAPTAIN_PRICE_ID`
   - `STRIPE_LEAGUE_PRICE_ID`
   - `STRIPE_FULL_COURT_PRICE_ID`
3. Confirm the live Stripe webhook endpoint is `https://www.tenaceiq.com/api/stripe/webhook` and includes the required lifecycle events.
4. Redeploy Production after the env swap.
5. Start one no-card checkout smoke from a Free QA account and confirm the returned Checkout Session ID starts with `cs_live_`, not `cs_test_`.
6. Run one controlled live payment for the lowest-risk paid plan, then confirm the profile access, billing event audit row, and customer portal handoff.
7. Refund or cancel the controlled live payment only through Stripe Dashboard, then confirm the corresponding webhook updates TenAceIQ access.

## Test-mode lifecycle pass

1. Player checkout
   - Start a Player checkout from `/upgrade?plan=player_plus`.
   - Complete checkout with a Stripe test card.
   - Confirm the profile has `stripe_customer_id`, `stripe_subscription_id`, `player_plus_subscription_active = true`, and `player_plus_subscription_status = active`.
   - Confirm `/admin/access` shows Stripe Managed and a handled latest Stripe event.

2. Captain checkout
   - Start a Captain checkout from `/upgrade?plan=captain`.
   - Complete checkout with a Stripe test card.
   - Confirm Player and Captain access are active for the profile.
   - Confirm the profile page can open billing portal management.

3. Subscription update
   - In Stripe test mode, update the subscription status or price.
   - Confirm `customer.subscription.updated` records a handled audit row in `stripe_billing_events`.
   - Confirm `/admin/access` reflects the resulting status.

4. Failed payment
   - Use a Stripe test payment method or invoice action that produces `invoice.payment_failed`.
   - Confirm the matching profile is downgraded to `past_due` and active access is revoked.
   - Confirm the admin Billing filter `Past due` finds the profile.

5. Cancellation
   - Cancel a test subscription.
   - Confirm `customer.subscription.deleted` downgrades the relevant plan to `canceled`.
   - Confirm the admin Billing filter `Canceled` finds the profile.

## Monitoring

- Check `/admin/access` after deployments. Review `Webhook Errors`, `Past Due`, `Canceled`, and `Stripe Managed` metrics.
- Check `/admin/product-events` after a checkout attempt. Confirm `upgrade_checkout_started` appears before the Stripe redirect, then compare it with later paid workspace events.
- Use Billing filter `Webhook errors` for events that need code or data follow-up.
- Use Billing filter `Ignored webhooks` to spot Stripe events that were received but did not map to a supported access action.
- In Supabase, inspect recent event outcomes:

```sql
select
  created_at,
  event_type,
  outcome,
  plan_id,
  resulting_status,
  profile_id,
  message
from public.stripe_billing_events
order by created_at desc
limit 50;
```

## Production smoke after deploy

- Open `/upgrade?plan=player_plus` and confirm the paid checkout handoff page renders.
- Open `/admin/access` as an admin and confirm billing metrics plus Billing filter render.
- Send only a signed synthetic webhook to production unless Stripe test-mode credentials are explicitly connected to the target environment.
