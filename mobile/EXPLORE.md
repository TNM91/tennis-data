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

## Recorded player ratings

My Lab (for a connected player) and Explore player details now load Overall, Singles, and Doubles TIQ ratings through one exact-player read. The query selects only three dynamic rating fields and the rating source, uses the existing signed-in Supabase boundary, and times out after 12 seconds. It introduces no grants, privileged credentials, backend routes, polling, or tier changes; these are recorded public rating values, not premium trends or matchup insights.

The panel uses the shared website formatter and discipline-to-overall fallback. Only finite recorded ratings from 1.5 through 7 are displayed; missing/invalid values remain unavailable. Fallback and self-rated records are labeled, and TIQ estimates are distinguished from official USTA ratings. Ratings fail and retry independently of match results. Account/screen revision and connected-element guards prevent late responses from populating another screen. There is no cross-account rating cache.

Local tests cover exact-player fields, timeout, error propagation, formatting, missing/invalid values, and fallback/source labels. Synthetic phone checks exercise My Lab and Explore alongside existing results and navigation. Native iPhone acceptance remains for the next TestFlight candidate.

## Player follows

The native Following tab reuses `user_follows`, scoped explicitly to the signed-in user and player entity type, with stable name/ID ordering, a 24-row limit, and a 12-second timeout. Player details opened from search, Rankings, or Following expose the same follow control. Saved names/subtitles are displayed as stored; a saved-player drilldown does not infer current location or flight from those labels. Teams/leagues follow management and a paginated complete list remain later work.

New follows use the existing server-enforced Player access boundary. Native account access comes from the bearer-authenticated `/api/auth/access` endpoint and the shared access model. Former members can remove existing follows through the existing DELETE behavior; after removal membership is rechecked before offering another add. No purchase link, entitlement override, database grant, or privileged client key is added.

Mutations use Capacitor HTTP to the fixed HTTPS `/api/follows` endpoint, with current-session bearer credentials, no redirects, and 12-second connection/read timeouts. Success requires the expected status, `ok`, and following state. An ambiguous failure requires a fresh status check before another toggle. Late screen/account responses are ignored; no follows or access result is cached across accounts. Existing website follows remain shared. This slice does not create the website's optional local activity-feed mirror or send notifications/invitations.

Tests cover owner scope, query bounds, server confirmation, failure/stale guards, and shared access rules. Synthetic phone verification covers empty → follow → saved-player drilldown → unfollow → empty, Free-account messaging without an add action, and no horizontal overflow. No real account follows were changed during verification. Native transport and account-switch acceptance remain for TestFlight; this work does not establish new production table grants or RLS policies.
