# AdSense Launch Checklist

Use this checklist after deployment and before or during AdSense review.

## Account and ads

- Confirm `ca-pub-1351888380884789` is the correct publisher id.
- Add real values for:
  - `NEXT_PUBLIC_ADSENSE_SLOT_HOME_INLINE`
  - `NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE_INLINE`
  - `NEXT_PUBLIC_ADSENSE_SLOT_RANKINGS_INLINE`
  - `NEXT_PUBLIC_ADSENSE_SLOT_PLAYERS_INLINE`
  - `NEXT_PUBLIC_ADSENSE_SLOT_LEAGUES_INLINE`
  - `NEXT_PUBLIC_ADSENSE_SLOT_TEAMS_INLINE`
  - `NEXT_PUBLIC_ADSENSE_SLOT_MATCHUP_INLINE`
- Verify ads only render on approved public routes.
- Confirm ads do not render on admin, captain, auth, My Lab, or API routes.

## Domain and trust

- Verify `https://tenaceiq.com/ads.txt` is publicly reachable.
- Verify `support@tenaceiq.com` is active.
- Verify `hello@tenaceiq.com` is active.
- Confirm About, Contact, FAQ, How It Works, Methodology, Advertising Disclosure, Privacy, Terms, and Cookies pages are live.

## Live QA

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
