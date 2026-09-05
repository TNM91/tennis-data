# Launch Owner Next Steps

This is an operational checklist, not legal, tax, or accounting advice. Confirm entity, tax, and legal decisions with a qualified professional before filing or charging customers.

## LLC registration

Official references:

- SBA business registration: https://www.sba.gov/business-guide/launch-your-business/register-your-business
- IRS EIN: https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number
- FinCEN BOI: https://www.fincen.gov/boi

Steps:

1. Choose the formation state.
2. Search the state business registry for the TenAceIQ legal name and any DBA/trade name needs.
3. Choose a registered agent in the formation state.
4. File LLC Articles of Organization with the state.
5. Create and store an LLC operating agreement.
6. After the LLC is accepted, apply for an EIN through the IRS.
7. Open the business bank account under the LLC/EIN.
8. Update Stripe business details, tax profile, payout account, support descriptor, and statement descriptor.
9. Check state and local tax/license requirements, annual reports, registered-agent renewals, and any foreign qualification if operating in more than one state.
10. Re-check FinCEN BOI status at filing time. FinCEN rules have changed recently, so use the current FinCEN page instead of old checklist notes.

Needed from owner:

- Formation state.
- Exact legal name.
- Registered agent choice.
- Business address/mailing address.
- Organizer/member details for filing.
- Whether TenAceIQ will use a DBA.

## Copyright and DMCA operations

Official reference:

- U.S. Copyright Office DMCA designated agent directory: https://www.copyright.gov/dmca-directory/

Current app status:

- `/legal/copyright` now covers ownership, user/imported content, notices, counter-notices, repeat infringement, misuse, and reservation of rights.
- `/legal/terms` links to the Copyright Policy.
- The app routes copyright requests through `/contact` until a formal DMCA agent is designated.

Before public launch:

1. Decide whether to designate a DMCA agent.
2. If yes, register and maintain the agent in the Copyright Office directory.
3. Add the designated agent contact details to `/legal/copyright`.
4. Keep a takedown log with notice date, claimant, URL/content, action, account, counter-notice status, and restoration/removal result.

## Pricing and charging

Current tiers:

- Free: `$0`.
- Player: `$1.99/month`.
- Coach: `$4.99/month`.
- Captain: `$4.99/month`.
- League: `$25/season`, one-time.
- Full-Court: `$9.99/month`.

Current Stripe readiness:

- Checkout has no coupon or promotion-code path; the Captain Pilot is the sole offer.
- Paid plan price env vars are mapped for Player, Coach, Captain, League, and Full-Court.
- Webhook readiness checks cover signed checkout and subscription lifecycle events.

Before live charges:

1. Confirm each live Stripe Price matches the public tier amount and interval.
2. Set live `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and live `STRIPE_*_PRICE_ID` values privately.
3. Redeploy.
4. Run `npm run qa:stripe-live-readiness`.
5. Run `npm run qa:stripe-live-catalog -- --stripe`.
6. Run `npm run qa:stripe-live-mode`.
7. Run one controlled low-risk live checkout, then verify profile access, billing event audit, and customer portal access.

## Fresh data reset

Use `npm run qa:data-reset-plan` to print the non-destructive reset plan.

The plan preserves:

- Supabase auth users.
- Profiles/accounts.
- Billing records and entitlements.
- Internal messages and support workflows.

The plan resets:

- Data Assist import staging.
- Import queue.
- Rating snapshots.
- Match accuracy reports.
- Team rosters.
- Match participants.
- Team summary records.
- Matches.
- Players.

Owner confirmation required before running any destructive SQL:

`I confirm resetting imported tennis data only, preserving accounts, profiles, billing, entitlements, and messages.`

After reset, import in this order:

1. Team Summary.
2. Season Schedule.
3. Scorecards.
4. Rating recalculation.
5. Spot-check `/players`, `/teams`, `/leagues`, `/rankings`, `/matchup`, `/admin/import-queue`.

## Admin launch operations

Current app status:

- `/admin/access` can grant Player, Coach, Captain, League, and Full-Court access.
- Admin can now set access end dates for manual/promotional grants.
- Expired manual grants stop unlocking paid features.

Before launch:

1. Apply the pending Supabase migration for access expiration fields.
2. Confirm `/admin/access` loads with the new `Until` fields.
3. Test a temporary access grant on a non-customer account.
4. Test an expired access grant and confirm the account returns to free access.
