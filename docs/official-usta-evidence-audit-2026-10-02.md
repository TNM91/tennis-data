# Official USTA evidence audit — October 2, 2026

## Verified access and evidence

Official TennisLink NTRP Advanced Search is publicly accessible without authentication:
https://tennislink.usta.com/Leagues/reports/NTRP/AdvancedSearch.aspx

Selected Championship Year 2026, USTA/MISSOURI VALLEY, ST. LOUIS, St. Louis Local Leagues, all levels/genders. The rendered report contains 2,000 rating rows. Retained local structured captures include source filters, capture timestamp, official player links, name, gender, city, state, level, rating date and designation. Raw player evidence remains in ignored artifacts/rating-evidence/official-usta, outside public application assets. Exactly 2,000 rows is a possible report limit; this is not evidence of complete district coverage. St. Louis district is only part of Missouri coverage; Missouri and Heart of America areas also need separate discovery.

Nathan Meinert, Lake Saint Louis MO: 4.5 C, December 31, 2025. This independently confirms the current published label directly on USTA's report. Official dynamic hundredth ratings are not supplied by this report.

Participant evidence found directly on the official report:

| Player | Published level | Effective date | Type |
|---|---:|---|---|
| Matthew Suddarth | 4.0 | 2025-12-31 | C |
| Brian Sabin | 4.5 | 2023-12-31 | C |
| Nick Jannett | 4.5 | 2024-12-31 | C |
| William Tosie | 4.5 | 2025-12-31 | A |
| Matt Mainer | 4.5 | 2026-05-01 | S |
| David Cabrera | 4.5 | 2025-12-31 | C |
| Brendan Czaicki | 4.5 | 2025-12-31 | C |
| Jon Tchen | 4.0 | 2025-12-31 | C |

Names and cities are candidate identity evidence, not permission to merge canonical identities automatically. Link the official player URL to reviewed canonical identity with roster/match corroboration before using a participant as an independently verified model prior. The report resolves Matthew's label gap, but that mapping still requires corroboration. Older C, A and S evidence must keep their actual dates/types; do not fabricate prior-season C labels.

## Historical trap reproduced

Repeated Advanced Search for Championship Year 2025, same section/district/area. It again renders 2,000 rows and shows Nathan's 2025-12-31 C label and Matt Mainer's 2026-05-01 S label. Thus the selected championship year does not freeze the displayed rating at that historical year. Treat the rating values as observations captured now, associated with a participation filter. Do not use this report as 2024 starting labels or as a retrospective as-of snapshot.

A valid historical outcome cohort requires a dated official historical record/archived snapshot showing the relevant year's outcome, plus stable identity. A recent report cannot reconstruct earlier levels merely by changing CYear. Raw captures made today must not enter past forecasts as facts known then.

## Authentication boundary

Clicking Nathan's official player link redirects to USTA Sign In. The available app browser has no signed-in USTA session; no connected extension browser is available. A sign-in request is pending. No password/session stores were inspected. Continue official roster/result/history verification in that browser after the user signs in. Public rating report access does not establish unattended authenticated collection or an official API agreement.

## Integration direction

Use USTA as authority for published levels, designation, rating dates and verified match results. Keep TennisRecord estimates as a separately named secondary benchmark. Existing lib/data-assist-export-parser.ts and data-assist/import paths support TennisLink roster, schedule and scorecard ingestion; no direct official annual-rating collector was found.

Build a separate append-only official rating observation path retaining source URL, capture time, effective date, designation, championship participation filter, official player key, identity review status and capture hash. Keep current observations distinct from verified historical outcomes and model starting priors. Segment public reports by district/area/league/level/gender as necessary and reconcile coverage before claiming completeness. Respect source access boundaries; authenticated match-history collection remains unresolved.

No production ratings, player identities or official-source database rows were changed during this audit. Prior importer/shadow PR #1457 passes all hosted checks as of this audit.

USTA's current player-search instructions:
https://customercare.usta.com/hc/en-us/articles/33967102119188-Searching-for-a-Player-and-View-their-NTRP-Rating

## Authenticated retry succeeded

User requested a retry after sign-in. Official player records are now accessible in the app browser. Nathan's identity is corroborated by Lake Saint Louis, MO and his registered Meinert/The Other Guys teams. Local captures preserve the rendered 2026 and 2027 Individual Player Records.

The 2027 report confirms September 13 and September 20, 2026 doubles wins, with official team-match IDs 1012222932 and 1012222936. These IDs identify team scorecards; they are not unique court IDs. Preserve court position and participant identities when reconciling.

The 2026 report contains 31 listed courts, including 19 played in calendar 2026. Combined with the two calendar-2026 courts in the 2027 report, this is 21 courts. It includes a September 30 win with Christopher Krieger against Trevor Neale/Eric Abramson, 5-7, 6-4, 1-0, #1 Doubles, team-match ID 1012101435. This court is absent from the earlier frozen v2 input graph, whose latest Nathan court is September 20. This establishes an additional snapshot completeness gap, not yet whether a subsequent production import has caught up.

The 4.72 diagnostic remains based on 15/20 accepted courts in that earlier graph. Do not reinterpret it as a complete 21-court official-source replay. Official match dates, winner-first score orientation, incomplete timed scores, match tiebreak treatment, and championship-year assignment must be retained when comparing source evidence. No production writes were made by this retry.
