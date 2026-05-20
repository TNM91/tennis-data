# TenAceIQ PR #123 Manual Test Checklist

PR: https://github.com/TNM91/tennis-data/pull/123

Target: PR #123 Vercel preview

Tester: Nathan

Date: 5/7/26
 
Browser: edge

Device(s):

## Quick Result

- [ y] Pass
- [ y] Pass with notes
- [ y] Blocked
- [ y] Needs fixes before merge

Overall notes:

________________________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________

## 0. Setup - 5 Minutes

- [ y] Open PR #123.
- [y ] Open the Vercel preview from the PR checks/comments.
- [y ] Confirm you are testing the preview, not production.
- [ y] Open desktop viewport.
- [ y] Open mobile viewport or browser device mode.
- [ y] Confirm the single dark-shell visual system loads.
- [y ] Confirm the page does not show a theme toggle.
- [y ] Sign out before starting the public-state pass.

Setup notes:

________________________________________________________________________________

________________________________________________________________________________

## 1. Public Visual Pass - 25 Minutes

### Home - `/`

Desktop:

- [ y] Header logo is sharp and aligned.
- [ y] Header spacing feels balanced.
- [N ] Navigation labels fit.
- [y] Lock icons are visible in the single dark-shell theme.
- [ y] Locked cues are readable against premium surfaces.
- [ y No horizontal scrolling.
- [ y] Hero typography feels intentional.
- [ y] "Choose your path" panel wraps cleanly.
- [y ] Compare tiers button is not cramped.
- [ y] Footer spacing feels clean.
- [ y] Footer lock icons match header lock icons.

Mobile:

- [y ] Header logo fits.
- [y ] Menu button is easy to tap.
- [ y] Mobile menu opens and closes.
- [ y] Locked items are readable in the single dark-shell theme.
- [ y] Locked items remain clear in the mobile menu.
- [ y] No sideways scrolling.
- [y ] Text does not overlap.
- [ y] Buttons fit their containers.
- [ y] Footer cards are readable.

Notes:

________________________________________________________________________________

________________________________________________________________________________

### Pricing - `/pricing`

Desktop:

- [ y] Plans are easy to compare.
- [ y] Tier names are clear.
- [y ] Price text is readable.
- [ y] Buttons align cleanly.
- [ N] Legal/support wording is easy to find.
- [ y] No crowded cards.
- [y ] No contrast issues in the single dark-shell theme.
- [ y] Pricing states remain readable across plan cards.

Mobile:

- [ y] Pricing cards stack cleanly.
- [ y] Plan buttons are easy to tap.
- [ y] Text wraps without clipping.
- [ n] No horizontal scrolling.
- [ y] Locked/unlocked tier meaning is clear.

Notes:

In the moble pricing page on mobile it does not have the same spacing as the home page it's cutting off the page on the ight (we need this checked across the board) How we work section in pricing page has a ton of wasted space on desktop________________________________________________________________

________________________________________________________________________________

### Matchup - `/matchup`

Desktop:

- [ y] Page loads without broken layout.
- [ y] Inputs and controls are clear.
- [ y] Buttons have enough spacing.
- [ N] Empty states are understandable.
- [ y] No contrast problems.

Mobile:

- [ y] Inputs fit the screen.
- [ y] Controls are easy to tap.
- [y ] Text does not overlap.
- [ N] No horizontal scrolling.

Notes:

____I cleared the player database but it looks like the players were still in the drop downs to select so when I picked them it errored out (the error buttons were hard to read) and then I was sent to the home page. Spacing on ALL pages for mobile should mirror the homepage ____________________________________________________________________________

________________________________________________________________________________

### Explore - `/explore`

Desktop:

- [y ] Search/explore controls feel aligned.
- [ y] Cards or lists scan cleanly.
- [ y] Header and footer remain consistent.
- [ y] No unexpected spacing jumps.

Mobile:

- [ y] Search/explore controls fit.
- [ n] Cards or lists stack cleanly.
- [ n] No horizontal scrolling.
- [ n] Text remains readable.

Notes:

_in mobile start here I can only see number 1 and 2 is cut off and on desktop it cuts off at 3 - ranking in mobile has cells that have text overlapping ex: active board 0/44 is outside of the cell - tune the board looks ruff - player cards have overlapping text in mobile____Between leagues, teams, player the design feels different and it's too dark at times. ___________________________________________________________________________

________________________________________________________________________________

### My Lab - `/mylab`

Public/free state:

- [ y] Locked state is clear.
- [y ] Upgrade path is clear.
- [ n] Copy feels tennis-specific.
- [n ] Layout is polished in the single dark-shell theme.
- [ n] Locked and unlocked states are visually distinct.
- [ n] Mobile layout is not squeezed.

Notes:

______________lots of design opportunities on both desktop and mobile things like blank font that you cant read and the old light theme felt bare like a white sheet__________________________________________________________________

________________________________________________________________________________

### Captain - `/captain`

Public/free state:

- [ y] Locked state is clear.
- [ n] Captain value is understandable.
- [ y] Upgrade path is clear.
- [ y] Header lock icon remains visible.
- [ y] Mobile content stacks cleanly.
- [y ] No oversized or cramped panels.

Notes:

_______The captain page still seems like a lot to take in also on bolbile the first box where you select your team on mobile is unecessarily strecthed. This should also default to teams you are apart of based on your profile since you will be logged in to access it     Captain tools took a moment to load on desktop however didn't show the spinning logo load which I don't know if we want that there or not?_________________________________________________________________________

________________________________________________________________________________

### Coordinator - `/league-coordinator`

Desktop:

- [ n] Hero spacing looks balanced.
- [ y] Setup form and registry fit side by side if expected.
- [ n] Text does not overflow.
- [ n] Buttons fit.
- [ y] Readiness/progress areas are readable.

Mobile:

- [n ] Page uses one clean column.
- [ n] Hero title wraps cleanly.
- [ n] Setup form is not squeezed.
- [ n] Registry is not squeezed.
- [ y] Details summary is readable.
- [ n] Inputs are full width where expected.
- [ n] No horizontal scrolling.
- [ n] Buttons are easy to tap.

Notes:

_______This needs an uplift lots of design and spacing issues_________________________________________________________________________

________________________________________________________________________________

### Join - `/join`

- [ y] Form or entry path is clear.
- [ y] Mobile layout is clean.
- [ y] No broken spacing.
- [ y] Calls to action are clear.
- [ y] Error/empty states are understandable if tested.

Notes:

________________________________________________________________________________

________________________________________________________________________________

### Login - `/login`

- [ y] Form fits desktop.
- [ y] Form fits mobile.
- [y ] Password/reset links are visible.
- [ y] Error states are readable if tested.
- [ y] Single dark-shell theme works.

Notes:

________________________________________________________________________________

________________________________________________________________________________

### Billing Legal - `/legal/billing`

- [ y] Cancellation wording is understandable.
- [ y] Refund wording is understandable.
- [ y] Renewal wording is understandable.
- [ n] Support path is clear.
- [ y] Payment processor wording is clear.
- [y ] Mobile layout is readable.

Notes:

_______How to request billing support
Email support@tenaceiq.com with the account email, plan, charge date, and a short description of the issue. We review refund and credit requests case by case. I do not have this email domain instead of email is there a type on help desk system we can build into the site where myslef and other admins can communicate with the members?_________________________________________________________________________

________________________________________________________________________________

## 2. Navigation And Single Theme Pass - 10 Minutes

Desktop:

- [ n] No theme toggle is exposed.
- [n ] Pages stay in the single dark-shell theme after refresh.
- [ y] Header logo renders correctly.
- [y ] Header lock icons remain visible.
- [ y] Footer lock icons remain visible.
- [y ] Header and footer lock glyphs match.
- [ y] Active nav state is clear.
- [ y] Hover states are not jarring.

Mobile:

- [ y] Mobile menu does not expose a theme toggle.
- [ y] Mobile menu does not shift awkwardly.
- [ y] Locked nav rows are readable.
- [ y] Tap targets feel large enough.
- [ n] Account/profile controls fit when signed in.

Notes:

___________It's overlapped on my desktop in the navigation with pricing when I'm logged in as an admin______in mobile the top manage profile section does not fit in mobile_______________________________________________________________

________________________________________________________________________________

## 3. Account And Access Flow - 20 Minutes

Public state:

- [y ] Public visitor can browse public pages.
- [ y] Locked features do not appear usable.
- [ y] Locked nav links route to upgrade/pricing flow.
- [y ] Public header shows sign in and start free.

Sign in:

- [ y] Login succeeds.
- [ y] Header updates after login.
- [ y] Profile/account area looks normal.
- [ y] Role pill or account label fits desktop.
- [ y] Role pill or account label fits mobile.
- [ y] Logout succeeds.
- [ y] Header returns to public state after logout.

Free/account state:

- [ y] My Lab access matches expected entitlement.
- [ y] Matchup access matches expected entitlement.
- [ y] Captain access matches expected entitlement.
- [ y] Coordinator access matches expected entitlement.
- [ y] Upgrade prompts are clear.
- [ y] No route exposes paid tools unexpectedly.

Notes:

___for public when I click my lab it tries to have me create an account and appears like I will then get access to it whereas really it needs to speak to the pricing system along with the creation of the account. it needs to be more clear... you will not get these features unless you not only create an account but also unlock this teir at this price_____________________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________

## 4. Payments, Refunds, And Support - 20 Minutes

Important:

- [ y] Confirm whether preview is using Stripe test mode.
- [ y] Do not use a real card unless intentionally testing live payments.

Pricing to checkout:

- [ ] Click Player plan checkout/start action.
- [ ] Checkout opens correctly.
- [ ] Plan name matches the selected plan.
- [ ] Price matches the selected plan.
- [ ] Billing interval is clear.
- [ ] Return/cancel path works.

Test checkout, if Stripe test mode is active:

- [ y] Use test card `4242 4242 4242 4242`.
- [ y] Use any future expiry.
- [ y] Use any CVC.
- [ y] Checkout success returns to TenAceIQ.
- [ y] Success page/handoff is understandable.
- [ y] Access updates after payment.

Billing portal:

- [ y] Billing portal opens for signed-in paid user.
- [ y] Payment method update path is clear.
- [ y] Cancellation path is clear.
- [ y] Plan update path is clear, if available.
- [y ] Portal return path works.

Refund/support clarity:

- [ y] `/legal/billing` explains refund handling.
- [ y] `/legal/billing` explains cancellation.
- [ y] `/legal/billing` explains failed payments.
- [ n] Support contact/path is clear.
- [ ] User can understand what happens after upgrade, cancel, or refund request.

Notes:

______see previous notes on internal guest and member communication system vs. email__________________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________

## 5. League Lifecycle - 20 Minutes

Coordinator setup:

- [ y] Open `/league-coordinator`.
- [ y] Confirm access state is correct for your test account.
- [ y] Create a new league.
- [ n] Required fields are obvious.
- [ y] Blank required fields show useful feedback.
- [ y] League format options are understandable.
- [ y] Team/player fields are clear.
- [n ] Dates/weeks are clear.
- [ n] Scoring options are clear.

Reasonable values:

- [ y] Create a normal league with reasonable weeks.
- [ y] Create or preview reasonable matchup count.
- [ y] Save succeeds.
- [ y] Registry updates.
- [ y] Edit flow opens existing league.
- [ y] Edits save.

Edge values:

- [n ] Try too many weeks.
- [ n] Try too many matchups.
- [ y] Try very long league name.
- [y ] Try weird characters in name.
- [ y] Try blank fields.
- [y ] Try date/order edge cases.
- [ y] App prevents or explains invalid values.

League completion/limits:

- [y ] UI does not imply leagues run forever.
- [ y] Week/matchup limits are visible or understandable.
- [ y] Finished/complete state is clear if available.
- [ n] Results entry path makes sense.
- [n ] Registry status makes sense.

Mobile:

- [ n] Setup form is usable on phone width.
- [n ] Registry is readable on phone width.
- [n ] Details panels open cleanly.
- [ n] Inputs do not overflow.
- [ n] Buttons remain tappable.

Notes:

___it shouldn't let you select a date that exceeds our maximum allowed league timeframe really you should set the number of weeks (which is capped) and then the start date and the end date should be understood  -  standard score doesn't explain what that means (how many sets, what about tie breaker, etc.) also in dynamic the third set is option and can be either played out or played as a 10 point tiebreaker_____________- league is missing option for the co-ordinator to either set scheduling or for individual league to schedule. I'd like the league members to easily schedule with oponents through the site (added system) and the option for the league co-ordinator to set site specific information and dates and times. this allows either a set date and time and place on a reoccuring schedule which everyone in the league can see the season schedule in advance, or for the co-ordinator to allow the players to schedule the matches (again through the site) and then players know who they play and when. I would also like to understand how match outcomes are being recorded here. ________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________

## 6. Final Smoke Pass - 10 Minutes

- [ y] Refresh home page.
- [ y] Refresh pricing page.
- [ y] Refresh matchup page.
- [ y] Refresh coordinator page.
- [ y] Navigate with browser back/forward.
- [ y] Open and close mobile menu repeatedly.
- [ y] Refresh after signing in and confirm the single theme remains.
- [ y] Refresh after signing out and confirm the single theme remains.
- [ y] Confirm no obvious broken images.
- [ y] Confirm no page has horizontal scrolling.
- [ y] Confirm nothing feels visually worse than production.

Final notes:

________________________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________

## Issue Log

### Issue 1

Page:

Mode: desktop / mobile

What happened:

________________________________________________________________________________

What you expected:

________________________________________________________________________________

Screenshot attached: yes / no

Severity: blocker / important / polish

### Issue 2

Page:

Mode: desktop / mobile

What happened:

________________________________________________________________________________

What you expected:

________________________________________________________________________________

Screenshot attached: yes / no

Severity: blocker / important / polish

### Issue 3

Page:

Mode: desktop / mobile

What happened:

________________________________________________________________________________

What you expected:

________________________________________________________________________________

Screenshot attached: yes / no

Severity: blocker / important / polish

### Issue 4

Page:

Mode: desktop / mobile

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
