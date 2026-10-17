# TIQ 1.2 population comparison

The repaired current-season graph supports 61,401 usable courts and 45,396 network players. This read-only comparison paired TIQ with 1,709 retained TennisRecord estimates, including 1,033 Missouri players. TIQ was reconstructed through each estimate's measurement date. TR estimates remain secondary comparisons, not official USTA outcomes.

## Comparable results

The earlier comparison contained 1,405 players; all have unchanged TR measurement dates and estimates in this report. Among the same 1,168 players with unchanged usable dated C starting labels, level-adjusted Pearson correlation increased from 0.6864 to 0.7099. Mean absolute TIQ change across the 1,405 common players was 0.0425. Imports advanced between runs, so this is not an isolated causal estimate of the ownership repair. The separate controlled court replay provides that comparison.

For the full newer sample, overall rank correlation is 0.9567. That measure is strongly influenced by differences between playing levels. Level-adjusted correlation is 0.7176 among the 1,427 players with usable starting labels, and 0.7693 among players with ten or more courts. These correlations are agreement measures, not accuracy percentages.

## Missouri review cases

These are same-date reconstructed values, rounded to three decimals. Raw TR and TIQ strength use different scales. A disagreement is a reason to inspect evidence, not an instruction to adjust TIQ toward TR.

| Player | TIQ | Raw TR | Usable courts | Starting C level |
| --- | ---: | ---: | ---: | ---: |
| Paul Rapponotti | 3.222 | 3.3036 | 14 | 3.5 |
| Anne Hope | 5.063 | 4.1690 | 37 | 4.0 |
| Rochelle Moore | 3.648 | 2.7796 | 23 | 3.0 |
| Clinton Little | 4.395 | 3.5300 | 13 | 4.0 |
| Jackie Gehrke | 5.267 | 4.3691 | 38 | 4.5 |
| Daniel Bogart | 4.047 | 3.2556 | 11 | 3.5 |
| Erwin Orendain | 2.854 | 2.7953 | 10 | 3.0 |
| Phyllis Norman | 4.980 | 4.1124 | 16 | 4.5 |

Cases were selected from players with ten or more usable courts using absolute departure from their level group's median TIQ-minus-TR gap. Group medians are descriptive, not conversion factors. Starting labels reported through TR do not establish the current official USTA level. Anne's high estimate remains a review case despite restoring ten courts; evidence repair does not guarantee an estimate moves toward an outside system.

Nathan's same-date TIQ is 4.5916 against raw TR 4.2931 with 17 courts. There is no fixed 0.5 adjustment.

## Publication reliability

The protected production rebuild completed without errors in 284.716 seconds, below the scheduled route's 300-second limit. Participant loading took 84.043 seconds, calculation/finalization 22.219 seconds, player publication 15.378 seconds, and snapshot publication 160.873 seconds. Snapshot publication is the largest measured cost. The shared lock currently reclaims stale runs after six minutes; extending runtime alone could permit overlapping publication after stale recovery. No timeout, lock, request pacing or write concurrency was changed for this audit.

Next implementation should reduce snapshot publication work or introduce recoverable publication stages with a corresponding lock lifecycle, then verify the scheduled production route. One successful local protected rebuild does not establish future scheduled reliability.

## Evidence and limits

Receipts: `artifacts/rating-evidence/network-1.2-tr-agreement.json` and `network-1.2-repair-comparison.json`. All analysis was read-only. Available archived estimates are not a representative population. Retrospective retained graphs and reconstructed labels are not frozen historical forecasts. These results do not validate USTA bump/drop probabilities or justify changing the match-update formula.
