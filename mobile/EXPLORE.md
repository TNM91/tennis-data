# Explore: first native slice

The bundled iPhone client now has My Lab and Explore navigation after sign-in. Explore searches public player records by explicit submission, using the existing read-only `players` query: literal name matching, two-to-80 characters, stable name/ID ordering, at most 12 results, and a 12-second timeout. No search runs on each keystroke.

Opening a player shows the public name, location, flight, and at most ten recent connected matches. Filters and outcomes describe the selected player, not the signed-in account. Match details show the selected player's side and return to the player; returning to search preserves the query, results, and focus. Browsing never links a player or writes a profile.

Search, profile detail, and match reads respect the existing Supabase authorization boundary. This slice adds no grants, privileged credentials, API routes, billing, or entitlement changes. Explore is available to all signed-in app users, without a paid-tier gate. Signed-out public browsing is not included yet.

Late responses are ignored after a newer search, screen disposal, or account change. Same-account token refresh and foreground transitions preserve Explore. Pending profile-link saves cannot be interrupted by switching the main navigation.

Local acceptance uses synthetic player/match fixtures for search, empty/error states, results, match details, back/focus restoration, and leaving during a pending search. These checks do not establish real-device acceptance or newly changed production grants; the underlying search and match APIs were already exercised by the first beta's player connection and recent results flows.

Further Explore work includes deeper player intelligence and team/league workflows.

## Teams and Leagues

Explore now includes Players, Teams, and Leagues categories. Team searches run only on explicit submission, with literal name matching and three bounded source queries (home/away parent matches plus public team observations, at most 20 rows each). Cards are deduplicated by team, league, and flight, capped at 12, and disclose limited or partial results. Shared pure name/match validation preserves the website directory's source-heading rules without bundling its separate Supabase client.

Opening a team requests at most ten parent records from each side, scoped to the exact selected team, league, and flight. The merged display contains at most ten deduplicated fixtures. Scores and status remain as recorded; no home/away winner inference or complete-season claim is added. Returning preserves the search, results, scroll, and focus.

Leagues reuse the existing public HTTPS `/api/leagues/summary` endpoint through Capacitor HTTP, without bearer credentials or redirects. Successful summaries are cached in memory for five minutes; overlapping requests share one pending load, and failed loads can be retried. Searching name/flight/season/area filters the summary locally. League details show the available season, area, team/match counts, and latest recorded match with a summary-coverage caveat. No new backend route, grants, polling job, or deployment service is introduced.

The existing endpoint returned HTTP 200 during bounded integration verification. Synthetic phone UI checks cover the actual mobile entry with public requests intercepted before delivery. Real iPhone acceptance of the native league HTTP handoff remains for TestFlight. Deeper league/team workflows remain later slices.

## Rankings

Explore includes Overall, Singles, and Doubles recorded TIQ leaders, with an optional explicit location filter. Queries respect the existing signed-in Supabase boundary and request only public player identity and rating fields. Each query is capped at 24 rows, ordered by rating then player ID, with a 12-second timeout. Singles/Doubles merge a separate, disjoint query for missing discipline ratings using the recorded overall rating, matching the shared website fallback rule. Missing or invalid ratings never become a synthetic default. Any failed query fails the complete view instead of presenting a partial ranking.

The display uses the shared two-decimal TIQ formatter, identifies overall fallback and self-rated records, and states that these are recorded TIQ leaders rather than official USTA rankings. It does not include activity eligibility, trends, confidence, awards, or a complete national leaderboard. Successful results are cached for five minutes within the current screen instance (at most six views); overlapping reads share a pending request and failures can be retried. Location input escapes wildcard characters and does not query on keystrokes.

Player and match drilldown reuse the existing read-only views, preserving ranking selection, location, results, scroll, and focus on return. Synthetic phone UI checks cover all three rating views, fallback labels, empty/error recovery, player/match drilldown, and no horizontal overflow. Query contract tests cover bounds, stable ordering, escaping, caching, and complete-view failure. Real-device ranking acceptance remains for the next TestFlight build.
