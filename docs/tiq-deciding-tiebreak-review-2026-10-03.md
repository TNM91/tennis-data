# TIQ deciding-tiebreak review — October 3, 2026

TIQ network 1.3 is live. A deciding match tiebreak now helps identify winner-first TennisRecord score orientation when the two preceding regular sets are split. The tiebreak still contributes no regular games to the game-share calculation. This correction requires an unchanged, conflict-free winning source receipt; it does not infer ownership from a shared name or change raw stored scores.

## Missouri review

Eight Missouri comparison cases were traced through retained source receipts. Five already used every imported court. Four excluded courts now have sufficient evidence: Phyllis Norman uses all 17 imported courts and Erwin Orendain all 13. Anne Hope still uses 37 of 39 and Jackie Gehrke 38 of 39 because three courts involve different primary source profiles without ownership proof. Those holds remain.

On the same captured graph, the correction adds 8,147 score orientations and restores 256 usable courts, increasing network evidence from 61,424 to 61,680 courts. Source-owned reviewed courts increase from 7,307 to 7,563. No starting-rating or rating-formula tuning was introduced.

## Verified live results

| Player | Overall TIQ | Singles TIQ | Doubles TIQ | Overall rated courts |
| --- | ---: | ---: | ---: | ---: |
| Nathan Meinert | 4.602 | 4.667 | 4.545 | 17 |
| Phyllis Norman | 4.964 | 4.500 | 4.964 | 17 |
| Erwin Orendain | 2.964 | 2.983 | 2.963 | 13 |
| Anne Hope | 5.055 | 4.000 | 5.055 | 37 |

A format value with little or no usable evidence can be a fallback estimate; do not interpret it as demonstrated performance. Nathan's official USTA level remains 4.5 C, separate from TIQ. A TIQ strength estimate is not a calibrated probability of an annual USTA bump.

## Validation and limits

For common August-and-later courts whose actual game-share target did not change, singles mean absolute error increased slightly from 0.164060 to 0.164254 across 559 courts. Doubles error decreased from 0.147958 to 0.147351 across 3,954 courts. This mixed result supports correcting source score interpretation, not a claim of universally improved prediction or validated USTA annual movement accuracy.

Release checks passed 3,284 tests, lint, typecheck, production build, schema checks and captain continuity. PR 1476 merged as 45168ad0f5745b8ee37d881dc8707620f9059bf6 and its production deployment is ready on www.tenaceiq.com.

The natural scheduled production run f47f9b73-d15c-4ada-adb9-af4ffb7633c1 completed at 21:51:03 UTC with HTTP 200 in 196.683 seconds. It published 45,417 network players and 61,680 usable courts. Publication saved 364,649 new or corrected history rows, preserved 591,847 identical rows and removed 26 stale rows. Verified current/future history equals the desired 956,496 rows. A previously verified rollback backup is retained.

TennisRecord source requests recovered from timeouts and resumed fresh processing. Some enrolled history pages remain overdue; importer-enabled status and retained-page processing do not establish complete source freshness. Missouri remains the priority for resolving that backlog.

Evidence: artifacts/rating-evidence/deciding-tiebreak-network-replay.json, deciding-tiebreak-live-verification.json, network-1.2-mo-held-evidence.json and network-1.2-mo-gap-classification.json. Release: https://github.com/TNM91/tennis-data/pull/1476.
