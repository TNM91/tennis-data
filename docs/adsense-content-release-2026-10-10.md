# Public tennis content release — October 10, 2026

The AdSense rejection reported low value content. This candidate adds three original guides and readable public match evidence to discovery and detail pages. It does not establish Google approval.

- Guides cover rating interpretation, doubles evidence, and matchup confidence, with explicitly hypothetical examples, methodology, attribution, and correction links.
- Player, ranking, and team pages include public evidence in initial HTML. Only supported, scored, non-future public results are promoted. Samples are labeled and do not claim career totals, official USTA rankings, or team-tie standings.
- Profiles with fewer than three supported results remain noindex. Discovery and sitemap additions are bounded; unreliable sitemap update dates are removed.
- Anonymous queries use daily caching and indexed player references. Automatic player/team link prefetch is disabled by default, preserving explicit overrides. No collector, cron, paid feature, database migration, or source-rating changes are included.
- Current production player-preview context and newer page behavior are preserved while integrating the evidence providers.

## Release checks

Release through a PR to master after Verify and TIQ Schema Audit pass. Branch previews are disabled for codex/**; no separate paid preview is needed for this content change. Production currently serves master commit 14bd411dec0c88ac5f83bfcf734c0379ec4b6a9e on a ready Vercel deployment.

After the Git production release, run the three content smoke scripts once with their URL variables set to https://www.tenaceiq.com and inspect a bounded recent error window. Unknown guide slugs must return 404; Next may log its internal NoFallbackError for that check.

Before requesting another AdSense review, verify the released pages and contact/correction paths, inspect Search Console indexing, and assess genuine user engagement. Automated smoke visits are not engagement evidence. Further evidenced coverage may still be needed; do not fabricate traffic, credentials, or freshness.

## Local validation

The isolated candidate passed full lint, standalone TypeScript, 705 test files / 3,677 tests, and a local production build. All three content smoke scripts passed against port 3130, covering guides, initial HTML facts, supported player/team samples, slash-containing team names, noindex/canonical rules, and sitemap entries. Browser verification confirmed the retained court disclosure after team hydration and no horizontal overflow at 390 pixels; checked browser warnings/errors were empty. The bounded server log contained only the expected unknown-guide NoFallbackError diagnostic. Local Node was 24; repository CI verifies Node 22 before release.
