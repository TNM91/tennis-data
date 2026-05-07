# TenAceIQ PR #123 Manual Test Checklist

PR: https://github.com/TNM91/tennis-data/pull/123

Target: PR #123 Vercel preview

Tester:

Date:

Browser:

Device(s):

## Quick Result

- [ ] Pass
- [ ] Pass with notes
- [ ] Blocked
- [ ] Needs fixes before merge

Overall notes:

________________________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________

## 0. Setup - 5 Minutes

- [ ] Open PR #123.
- [ ] Open the Vercel preview from the PR checks/comments.
- [ ] Confirm you are testing the preview, not production.
- [ ] Open desktop viewport.
- [ ] Open mobile viewport or browser device mode.
- [ ] Confirm light mode works.
- [ ] Confirm dark mode works.
- [ ] Sign out before starting the public-state pass.

Setup notes:

________________________________________________________________________________

________________________________________________________________________________

## 1. Public Visual Pass - 25 Minutes

### Home - `/`

Desktop:

- [ ] Header logo is sharp and aligned.
- [ ] Header spacing feels balanced.
- [ ] Navigation labels fit.
- [ ] Lock icons are visible in light mode.
- [ ] Lock icons are visible in dark mode.
- [ ] No horizontal scrolling.
- [ ] Hero typography feels intentional.
- [ ] "Choose your path" panel wraps cleanly.
- [ ] Compare tiers button is not cramped.
- [ ] Footer spacing feels clean.
- [ ] Footer lock icons match header lock icons.

Mobile:

- [ ] Header logo fits.
- [ ] Menu button is easy to tap.
- [ ] Mobile menu opens and closes.
- [ ] Locked items are readable in light mode.
- [ ] Locked items are readable in dark mode.
- [ ] No sideways scrolling.
- [ ] Text does not overlap.
- [ ] Buttons fit their containers.
- [ ] Footer cards are readable.

Notes:

________________________________________________________________________________

________________________________________________________________________________

### Pricing - `/pricing`

Desktop:

- [ ] Plans are easy to compare.
- [ ] Tier names are clear.
- [ ] Price text is readable.
- [ ] Buttons align cleanly.
- [ ] Legal/support wording is easy to find.
- [ ] No crowded cards.
- [ ] No contrast issues in light mode.
- [ ] No contrast issues in dark mode.

Mobile:

- [ ] Pricing cards stack cleanly.
- [ ] Plan buttons are easy to tap.
- [ ] Text wraps without clipping.
- [ ] No horizontal scrolling.
- [ ] Locked/unlocked tier meaning is clear.

Notes:

________________________________________________________________________________

________________________________________________________________________________

### Matchup - `/matchup`

Desktop:

- [ ] Page loads without broken layout.
- [ ] Inputs and controls are clear.
- [ ] Buttons have enough spacing.
- [ ] Empty states are understandable.
- [ ] No contrast problems.

Mobile:

- [ ] Inputs fit the screen.
- [ ] Controls are easy to tap.
- [ ] Text does not overlap.
- [ ] No horizontal scrolling.

Notes:

________________________________________________________________________________

________________________________________________________________________________

### Explore - `/explore`

Desktop:

- [ ] Search/explore controls feel aligned.
- [ ] Cards or lists scan cleanly.
- [ ] Header and footer remain consistent.
- [ ] No unexpected spacing jumps.

Mobile:

- [ ] Search/explore controls fit.
- [ ] Cards or lists stack cleanly.
- [ ] No horizontal scrolling.
- [ ] Text remains readable.

Notes:

________________________________________________________________________________

________________________________________________________________________________

### My Lab - `/mylab`

Public/free state:

- [ ] Locked state is clear.
- [ ] Upgrade path is clear.
- [ ] Copy feels tennis-specific.
- [ ] Layout is polished in light mode.
- [ ] Layout is polished in dark mode.
- [ ] Mobile layout is not squeezed.

Notes:

________________________________________________________________________________

________________________________________________________________________________

### Captain - `/captain`

Public/free state:

- [ ] Locked state is clear.
- [ ] Captain value is understandable.
- [ ] Upgrade path is clear.
- [ ] Header lock icon remains visible.
- [ ] Mobile content stacks cleanly.
- [ ] No oversized or cramped panels.

Notes:

________________________________________________________________________________

________________________________________________________________________________

### Coordinator - `/league-coordinator`

Desktop:

- [ ] Hero spacing looks balanced.
- [ ] Setup form and registry fit side by side if expected.
- [ ] Text does not overflow.
- [ ] Buttons fit.
- [ ] Readiness/progress areas are readable.

Mobile:

- [ ] Page uses one clean column.
- [ ] Hero title wraps cleanly.
- [ ] Setup form is not squeezed.
- [ ] Registry is not squeezed.
- [ ] Details summary is readable.
- [ ] Inputs are full width where expected.
- [ ] No horizontal scrolling.
- [ ] Buttons are easy to tap.

Notes:

________________________________________________________________________________

________________________________________________________________________________

### Join - `/join`

- [ ] Form or entry path is clear.
- [ ] Mobile layout is clean.
- [ ] No broken spacing.
- [ ] Calls to action are clear.
- [ ] Error/empty states are understandable if tested.

Notes:

________________________________________________________________________________

________________________________________________________________________________

### Login - `/login`

- [ ] Form fits desktop.
- [ ] Form fits mobile.
- [ ] Password/reset links are visible.
- [ ] Error states are readable if tested.
- [ ] Light and dark modes both work.

Notes:

________________________________________________________________________________

________________________________________________________________________________

### Billing Legal - `/legal/billing`

- [ ] Cancellation wording is understandable.
- [ ] Refund wording is understandable.
- [ ] Renewal wording is understandable.
- [ ] Support path is clear.
- [ ] Payment processor wording is clear.
- [ ] Mobile layout is readable.

Notes:

________________________________________________________________________________

________________________________________________________________________________

## 2. Navigation And Theme Pass - 10 Minutes

Desktop:

- [ ] Switch light to dark.
- [ ] Switch dark to light.
- [ ] Header logo changes correctly.
- [ ] Header lock icons remain visible in both modes.
- [ ] Footer lock icons remain visible in both modes.
- [ ] Header and footer lock glyphs match.
- [ ] Active nav state is clear.
- [ ] Hover states are not jarring.

Mobile:

- [ ] Theme toggle works inside mobile menu.
- [ ] Mobile menu does not shift awkwardly.
- [ ] Locked nav rows are readable.
- [ ] Tap targets feel large enough.
- [ ] Account/profile controls fit when signed in.

Notes:

________________________________________________________________________________

________________________________________________________________________________

## 3. Account And Access Flow - 20 Minutes

Public state:

- [ ] Public visitor can browse public pages.
- [ ] Locked features do not appear usable.
- [ ] Locked nav links route to upgrade/pricing flow.
- [ ] Public header shows sign in and start free.

Sign in:

- [ ] Login succeeds.
- [ ] Header updates after login.
- [ ] Profile/account area looks normal.
- [ ] Role pill or account label fits desktop.
- [ ] Role pill or account label fits mobile.
- [ ] Logout succeeds.
- [ ] Header returns to public state after logout.

Free/account state:

- [ ] My Lab access matches expected entitlement.
- [ ] Matchup access matches expected entitlement.
- [ ] Captain access matches expected entitlement.
- [ ] Coordinator access matches expected entitlement.
- [ ] Upgrade prompts are clear.
- [ ] No route exposes paid tools unexpectedly.

Notes:

________________________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________

## 4. Payments, Refunds, And Support - 20 Minutes

Important:

- [ ] Confirm whether preview is using Stripe test mode.
- [ ] Do not use a real card unless intentionally testing live payments.

Pricing to checkout:

- [ ] Click Player plan checkout/start action.
- [ ] Checkout opens correctly.
- [ ] Plan name matches the selected plan.
- [ ] Price matches the selected plan.
- [ ] Billing interval is clear.
- [ ] Return/cancel path works.

Test checkout, if Stripe test mode is active:

- [ ] Use test card `4242 4242 4242 4242`.
- [ ] Use any future expiry.
- [ ] Use any CVC.
- [ ] Checkout success returns to TenAceIQ.
- [ ] Success page/handoff is understandable.
- [ ] Access updates after payment.

Billing portal:

- [ ] Billing portal opens for signed-in paid user.
- [ ] Payment method update path is clear.
- [ ] Cancellation path is clear.
- [ ] Plan update path is clear, if available.
- [ ] Portal return path works.

Refund/support clarity:

- [ ] `/legal/billing` explains refund handling.
- [ ] `/legal/billing` explains cancellation.
- [ ] `/legal/billing` explains failed payments.
- [ ] Support contact/path is clear.
- [ ] User can understand what happens after upgrade, cancel, or refund request.

Notes:

________________________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________

## 5. League Lifecycle - 20 Minutes

Coordinator setup:

- [ ] Open `/league-coordinator`.
- [ ] Confirm access state is correct for your test account.
- [ ] Create a new league.
- [ ] Required fields are obvious.
- [ ] Blank required fields show useful feedback.
- [ ] League format options are understandable.
- [ ] Team/player fields are clear.
- [ ] Dates/weeks are clear.
- [ ] Scoring options are clear.

Reasonable values:

- [ ] Create a normal league with reasonable weeks.
- [ ] Create or preview reasonable matchup count.
- [ ] Save succeeds.
- [ ] Registry updates.
- [ ] Edit flow opens existing league.
- [ ] Edits save.

Edge values:

- [ ] Try too many weeks.
- [ ] Try too many matchups.
- [ ] Try very long league name.
- [ ] Try weird characters in name.
- [ ] Try blank fields.
- [ ] Try date/order edge cases.
- [ ] App prevents or explains invalid values.

League completion/limits:

- [ ] UI does not imply leagues run forever.
- [ ] Week/matchup limits are visible or understandable.
- [ ] Finished/complete state is clear if available.
- [ ] Results entry path makes sense.
- [ ] Registry status makes sense.

Mobile:

- [ ] Setup form is usable on phone width.
- [ ] Registry is readable on phone width.
- [ ] Details panels open cleanly.
- [ ] Inputs do not overflow.
- [ ] Buttons remain tappable.

Notes:

________________________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________

## 6. Final Smoke Pass - 10 Minutes

- [ ] Refresh home page.
- [ ] Refresh pricing page.
- [ ] Refresh matchup page.
- [ ] Refresh coordinator page.
- [ ] Navigate with browser back/forward.
- [ ] Open and close mobile menu repeatedly.
- [ ] Toggle theme after signing in.
- [ ] Toggle theme after signing out.
- [ ] Confirm no obvious broken images.
- [ ] Confirm no page has horizontal scrolling.
- [ ] Confirm nothing feels visually worse than production.

Final notes:

________________________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________

## Issue Log

### Issue 1

Page:

Mode: desktop / mobile, light / dark

What happened:

________________________________________________________________________________

What you expected:

________________________________________________________________________________

Screenshot attached: yes / no

Severity: blocker / important / polish

### Issue 2

Page:

Mode: desktop / mobile, light / dark

What happened:

________________________________________________________________________________

What you expected:

________________________________________________________________________________

Screenshot attached: yes / no

Severity: blocker / important / polish

### Issue 3

Page:

Mode: desktop / mobile, light / dark

What happened:

________________________________________________________________________________

What you expected:

________________________________________________________________________________

Screenshot attached: yes / no

Severity: blocker / important / polish

### Issue 4

Page:

Mode: desktop / mobile, light / dark

What happened:

________________________________________________________________________________

What you expected:

________________________________________________________________________________

Screenshot attached: yes / no

Severity: blocker / important / polish

## Merge Decision

- [ ] Merge PR #123.
- [ ] Fix issues first.
- [ ] Retest after fixes.

Decision notes:

________________________________________________________________________________

________________________________________________________________________________

