# Explore: first native slice

The bundled iPhone client now has My Lab and Explore navigation after sign-in. Explore searches public player records by explicit submission, using the existing read-only `players` query: literal name matching, two-to-80 characters, stable name/ID ordering, at most 12 results, and a 12-second timeout. No search runs on each keystroke.

Opening a player shows the public name, location, flight, and at most ten recent connected matches. Filters and outcomes describe the selected player, not the signed-in account. Match details show the selected player's side and return to the player; returning to search preserves the query, results, and focus. Browsing never links a player or writes a profile.

Search, profile detail, and match reads respect the existing Supabase authorization boundary. This slice adds no grants, privileged credentials, API routes, billing, or entitlement changes. Explore is available to all signed-in app users, without a paid-tier gate. Signed-out public browsing is not included yet.

Late responses are ignored after a newer search, screen disposal, or account change. Same-account token refresh and foreground transitions preserve Explore. Pending profile-link saves cannot be interrupted by switching the main navigation.

Local acceptance uses synthetic player/match fixtures for search, empty/error states, results, match details, back/focus restoration, and leaving during a pending search. These checks do not establish real-device acceptance or newly changed production grants; the underlying search and match APIs were already exercised by the first beta's player connection and recent results flows.

Remaining Explore slices: team directory, league discovery, rankings, and deeper player intelligence. Do not present inactive tabs for these features.
