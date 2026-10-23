# Explore: first native slice

The bundled iPhone client now has My Lab and Explore navigation after sign-in. Explore searches public player records by explicit submission, using the existing read-only `players` query: literal name matching, two-to-80 characters, stable name/ID ordering, at most 12 results, and a 12-second timeout. No search runs on each keystroke.

Opening a player shows the public name, location, flight, and at most ten recent connected matches. Filters and outcomes describe the selected player, not the signed-in account. Match details show the selected player's side and return to the player; returning to search preserves the query, results, and focus. Browsing never links a player or writes a profile.

Search, profile detail, and match reads respect the existing Supabase authorization boundary. This slice adds no grants, privileged credentials, API routes, billing, or entitlement changes. Explore is available to all signed-in app users, without a paid-tier gate. Signed-out public browsing is not included yet.

Late responses are ignored after a newer search, screen disposal, or account change. Same-account token refresh and foreground transitions preserve Explore. Pending profile-link saves cannot be interrupted by switching the main navigation.

Local acceptance uses synthetic player/match fixtures for search, empty/error states, results, match details, back/focus restoration, and leaving during a pending search. These checks do not establish real-device acceptance or newly changed production grants; the underlying search and match APIs were already exercised by the first beta's player connection and recent results flows.

Remaining Explore slices: team directory, league discovery, rankings, and deeper player intelligence. Do not present inactive tabs for these features.

## Teams and Leagues

Explore now includes Players, Teams, and Leagues categories. Team searches run only on explicit submission, with literal name matching and three bounded source queries (home/away parent matches plus public team observations, at most 20 rows each). Cards are deduplicated by team, league, and flight, capped at 12, and disclose limited or partial results. Shared pure name/match validation preserves the website directory's source-heading rules without bundling its separate Supabase client.

Opening a team requests at most ten parent records from each side, scoped to the exact selected team, league, and flight. The merged display contains at most ten deduplicated fixtures. Scores and status remain as recorded; no home/away winner inference or complete-season claim is added. Returning preserves the search, results, scroll, and focus.

Leagues reuse the existing public HTTPS `/api/leagues/summary` endpoint through Capacitor HTTP, without bearer credentials or redirects. Successful summaries are cached in memory for five minutes; overlapping requests share one pending load, and failed loads can be retried. Searching name/flight/season/area filters the summary locally. League details show the available season, area, team/match counts, and latest recorded match with a summary-coverage caveat. No new backend route, grants, polling job, or deployment service is introduced.

The existing endpoint returned HTTP 200 during bounded integration verification. Synthetic phone UI checks cover the actual mobile entry with public requests intercepted before delivery. Real iPhone acceptance of the native league HTTP handoff remains for TestFlight. Rankings and deeper league/team workflows remain later slices.
