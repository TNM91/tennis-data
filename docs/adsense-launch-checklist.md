# AdSense Launch Checklist

Use this checklist after deployment and before or during AdSense review.

## Readiness check — October 2, 2026

- Deployed to production: `dpl_CG5LWUbKXwJ1QgshGSbTUQT8SwqK`, serving `https://www.tenaceiq.com`.
- Live smoke passed seven public routes, nine trust pages, policy files, and eight private/auth/workspace route checks. Both apex and www serve the valid ads.txt publisher line.
- Fresh signed-out Explore browser check initialized unit `2587975824` (`done`, `unfilled`) with one AdSense loader, no `data-nscript` attribute, and no console warnings/errors. Fresh sign-in loads no ad units or AdSense loader. Unfilled does not establish approval or successful ad delivery.
- Ad scripts now load only for valid public placements. Publisher ownership metadata remains present; malformed unit IDs are rejected; labels and Google advertising-cookie disclosures are updated.
- Isolated production release passed lint, typecheck, the full test suite (2,980 initial passing tests plus all 146 tests in the nine suites rerun after restoring the required undici dependency), and a completed Vercel production build. Final ad regression checks: 16 passed.
- AdSense ownership is verified and review is already requested; Sites still reports Getting ready. Google's dashboard still reports ads.txt Not found despite the live 200 response and correct publisher line; allow its crawl status to update.
- Auto ads is confirmed Off. European consent (accept, reject in all supported regions, manage options; optimization Off) and US state opt-out messages (all supported current/future US states) are Published. Privacy policy URL is `https://www.tenaceiq.com/legal/privacy`.
- Google says published messages may take up to an hour to appear. Regional accept/reject/reopen consent flows and actual filled ad delivery still need a live check after propagation/review; publishing alone does not prove those flows or approval. Mailbox delivery has not been verified.

## Account and ads

- In AdSense **Sites**, add `tenaceiq.com` and verify ownership using the existing `google-adsense-account` meta tag or `ads.txt`. Wait for Google to mark the site ready; passing technical checks does not guarantee approval.
- Confirm `ca-pub-1351888380884789` is the correct publisher id.
- Keep **Auto ads off** for this implementation. The site uses deliberate manual placements; a script already loaded during client navigation can remain active on subsequent private pages. Do not rely only on the route guard to contain Auto ads.
- Add real values for:
  - `NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE_INLINE`
  - `NEXT_PUBLIC_ADSENSE_SLOT_RANKINGS_INLINE`
  - `NEXT_PUBLIC_ADSENSE_SLOT_PLAYERS_INLINE`
  - `NEXT_PUBLIC_ADSENSE_SLOT_LEAGUES_INLINE`
  - `NEXT_PUBLIC_ADSENSE_SLOT_TEAMS_INLINE`
  - `NEXT_PUBLIC_ADSENSE_SLOT_MATCHUP_INLINE`
- Verify ads only render on approved public routes.
- Confirm ads do not render on admin, captain, auth, My Lab, or API routes.
- Copy each ten-digit ad unit ID from AdSense (not the publisher ID or a placeholder), set the corresponding production environment variable, and rebuild/redeploy. Empty or invalid IDs render no placement and load no ad script.
- The current homepage has no manual ad placement. `NEXT_PUBLIC_ADSENSE_SLOT_HOME_INLINE` is a legacy setting and does not enable a homepage ad.

## Consent before serving ads

- In AdSense **Privacy & messaging**, publish a European regulations message for the site using Google's certified CMP (or configure another Google-certified CMP). Use `https://www.tenaceiq.com/legal/privacy` as the privacy policy URL. Confirm the message and consent choices work for visitors in the EEA, UK, and Switzerland before enabling ad units.
- Review applicable US state privacy messages and configure opt-out choices for the regions served. Verify that visitors can reopen privacy choices and withdraw consent through the published CMP.
- Test accept, reject, and manage-options flows in the browser; this cannot be proved by the HTML smoke script. Do not replace the certified CMP with a homemade cookie banner.
- Google reference: [CMP requirements](https://support.google.com/adsense/answer/13554116), [create a European regulations message](https://support.google.com/adsense/answer/10960768), and [Privacy & messaging](https://support.google.com/adsense/answer/10924669).

## Domain and trust

- Verify `https://tenaceiq.com/ads.txt` is publicly reachable.
- Verify `support@tenaceiq.com` is active.
- Verify `hello@tenaceiq.com` is active.
- Confirm About, Contact, FAQ, How It Works, Methodology, Advertising Disclosure, Privacy, Terms, and Cookies pages are live.

## Live QA

- Run `npm run qa:adsense-live` after deployment to verify public routes, trust pages, `ads.txt`, `robots.txt`, `sitemap.xml`, and private-route ad exclusions.
- The smoke's `ok` result means its technical checks passed. It does not verify AdSense approval, consent settings, production ad unit environment variables, mailbox delivery, or browser ad delivery. Placements wait for client authentication checks, so `hasAdMarkup: false` in server HTML does not prove ad units are disabled. Check a signed-out browser after hydration to verify delivery.
- Check home, explore, rankings, players, leagues, teams, and matchup on desktop.
- Check the same routes on mobile.
- Confirm ads are clearly labeled and visually separate from navigation and action buttons.
- Confirm no ad appears inside empty states, loading states, or error states.
- Confirm public pages still make sense and feel useful with ads disabled.

## Crawl and policy

- Confirm `robots.txt` and `sitemap.xml` are live.
- Confirm private and utility routes remain `noindex`.
- Confirm no thin, placeholder, or accidental internal routes are publicly indexed.

## Submission readiness

- Re-read the live public site as a first-time visitor.
- Make sure the site clearly explains:
  - what TenAceIQ is
  - who it is for
  - how it works
  - how to contact the team
- Only request review once those live checks pass.
