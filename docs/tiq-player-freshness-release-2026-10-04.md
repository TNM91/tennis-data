# Player import freshness release — October 4, 2026

Player profiles now distinguish match-history import freshness, latest rated-result dates, rated-result counts and total imported match history. The public freshness endpoint returns only aggregate dates and queue states; analysis source names, URLs, identifiers and raw records remain internal.

Only one resolved source identity qualifies for a freshness claim. The endpoint reads exact current championship-year history URLs, including next season during fall play. It uses the oldest successful capture across the expected histories. Missing captures show pending; due histories show overdue; review states remain visible. Ambiguous or multiple source identities show unverified freshness. A freshness date cannot establish that every scorecard has been reconciled or rated.

Responses cache for five minutes. Query failures return an uncached unavailable state. Existing rating calculations, membership rules, request pacing, source backoff and identity holds are unchanged.

Focused validation: five aggregation tests and three API tests cover missing coverage, due dates, review states, invalid dates, ambiguous identities, identifier validation and source-locator privacy. Lint and typecheck passed. Preview verified Nathan's history refresh date as October 2, 2026, within schedule.

PR https://github.com/TNM91/tennis-data/pull/1478. Full CI passed 3,292 tests, lint, typecheck, production build, schema audit and captain continuity. Merge commit 96fd8d98c1b938acf69377b31f0d097346c4f992 is deployed READY as dpl_Gxw4PJ1SRRBsgeweVK6pynPmhroD on www.tenaceiq.com. Live browser verification confirmed the freshness display for Nathan. Screenshot: artifacts/rating-evidence/player-freshness-live.jpg. Related read-only analysis: tiq-missouri-score-prediction-2026-10-04.md.
