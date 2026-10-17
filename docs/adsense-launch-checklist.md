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

### Content-quality rejection — October 10, 2026

The reported rejection is **Low value content**. Earlier technical readiness checks do not establish approval or sufficient publisher value. Hold another review request until the content and crawl checks below pass on the released site.

- Local content candidate: three public tennis intelligence guides under `/resources/guides/`, linked from Home, Explore, and Resources. Examples are explicitly hypothetical; rating arithmetic follows `lib/recalculateRatings.ts`. They do not claim to be official USTA calculations or observed player case studies.
- Guide bodies are rendered on the server and have canonical metadata, article attribution, publication dates, methodology links, related reading, and practical next actions. No ad placements are added to guide pages.
- The sitemap includes the guide routes with their recorded publication dates. Existing routes omit `lastModified` where no reliable editorial date is available, rather than presenting every sitemap generation as a content update.
- Player-content candidate: `/players` and `/explore/players` include server-rendered public evidence links. Player profiles show a factual server snapshot while the existing interactive history loads, and retain that snapshot if the interactive loader fails. Only anonymous-readable identities and public-history-eligible results are requested; exact TiQ ratings and member insights are excluded.
- Discovery checks a bounded recent sample, then the histories of at most 16 candidates. At most 12 profiles with three or more scored results and fully named lineups are promoted in both directories and the sitemap. Sparse profiles remain available with `noindex`; confirmed missing profiles use the not-found flow; data outages propagate as failures rather than cached missing profiles.
- Future dates are filtered before the query limit and in evidence validation. Placeholder scores, retirements/defaults, missing identities, and ambiguous lineups do not count toward discovery. Match dates describe evidence freshness, not page-edit timestamps. These are recorded public facts, not a claim of independent scorecard verification.
- Cost design: four bounded anonymous GET requests per discovery refresh (up to 96 matches / 384 participants per pass), reused by both directories and sitemap through Next's daily fetch cache. A profile adds up to three bounded cached GET requests, plus the existing metadata lookup. Cold builds or parallel cache misses may duplicate requests; no cron, polling, or collector cadence changes are added. Preserve the existing daily ISR cadence.
- Player-specific queries start from indexed `match_players` references and order by the related match date before applying the bound. A read-only probe measured the former global-match join timing out with database code `57014` after about 3.4 seconds; the indexed-reference query returned that profile in about 310 ms. Error causes are retained. Profile links on the affected directory, initial snapshot, and interactive profile disable automatic prefetching so visible links do not fan out unrequested profile reads.
- Ranking/team content candidate: `/rankings` and `/explore/rankings` include a server-rendered overall TiQ evidence snapshot, limited to scored public profiles from a bounded candidate set. Raw decimal ratings stay on the server; displayed reads use the existing public integer mask and are explicitly distinguished from official USTA rankings. Snapshots are hidden when visitors choose a different format or apply filters.
- `/teams` and `/explore/teams` include evidenced team links. Team profiles show scored court records in initial HTML and retain them in a public disclosure after the full tools load. Court wins/losses are explicitly separate from team-tie standings; each record carries its competition, flight, date, and opponent. Unscoped snapshots are not substituted for league/flight-filtered team views. Sparse team pages receive `noindex`; only teams with at least three scored court results are promoted in the sitemap. Slash-containing names use the established `~2F` route encoding for links and canonicals.
- Incremental cost design: up to three cached daily anonymous GETs for the ranking snapshot (24 rating candidates, 96 match references, up to 384 participants); one cached daily 96-row query for team discovery, shared by both directories and sitemap; one cached bounded query per team name. A read-only pilot returned seven ranking profiles and 12 teams in about 854 ms combined, with a sampled team lookup around 107 ms. Shared entity/tracked links default to no automatic player/team prefetch, while preserving explicit caller overrides. No collector, cron, refresh cadence, or paid feature changes are introduced.
- Still required: broader evidenced discovery beyond these bounded starting sets; production verification of the released changes; review Search Console indexing and actual user engagement. Future-dated source records were observed during read-only verification; these changes filter them from new evidence and player history, and do not repair source records or recalculate ratings.
- After release, verify each guide returns 200 with its full body in initial HTML, unknown guide slugs return 404, canonical URLs are correct, and all discovery links and sitemap entries work. Check narrow-screen readability.
- Confirm factual data sourcing and correction workflows, and verify contact mailbox delivery. Do not fabricate traffic, editorial credentials, player results, or freshness evidence.
- Content improvements reduce an identified weakness but do not guarantee Google approval. Request review only after the released candidate is checked and the remaining evidence gaps are resolved.
- Local verification: full lint, standalone typecheck, 524 test files / 2,526 tests, and the final production build passed. `node scripts/tennis-guides-smoke.mjs` passed against the local production server, including full HTML content and unknown-slug 404. Browser inspection passed at desktop and 390-pixel phone width with no horizontal overflow. This candidate has not been deployed or submitted for review.
- Player batch local verification: final full lint, 526 test files / 2,534 tests, and production build (including TypeScript) passed. Standalone typecheck also passed during the focused loop. `node scripts/public-player-content-smoke.mjs` passed against the final local bundle: 12 discoverable profiles, both directories with readable HTML match facts, two scored profile snapshots (including the formerly timing-out profile), canonical/indexing checks, missing-profile protection, and matching sitemap entries. The earlier guide smoke passed with the updated sitemap. Signed-out navigation progressed from the public snapshot to the full profile; the compact tape retained Oct 5 rather than shifting to Oct 4. Directory and profile fit the phone viewport without horizontal overflow. The formerly failing profile opened normally after the indexed-query fix; the checked browser diagnostics were clean and no public-query failures recurred in the bounded final server log. The unknown-guide smoke returned 404 and emitted Next's internal `NoFallbackError` diagnostic. These changes remain local and unsubmitted.

- Ranking/team batch local verification: full lint, standalone typecheck, 529 test files / 2,545 tests, and the final production build passed. The competition smoke verified seven ranking profiles, 12 team profiles, four directory routes, three scored team snapshots including a slash-containing name, canonical/indexing checks, and sitemap alignment. Earlier player and guide smokes also passed against this bundle. Browser verification confirmed that choosing Singles hides the overall snapshot and that scored court records remain available after the full team page loads. The expanded team disclosure fit a 390-pixel phone viewport without horizontal overflow; checked browser warnings/errors were empty. These changes remain local and unsubmitted.

- Re-read the live public site as a first-time visitor.
- Make sure the site clearly explains:
  - what TenAceIQ is
  - who it is for
  - how it works
  - how to contact the team
- Only request review once those live checks pass.
