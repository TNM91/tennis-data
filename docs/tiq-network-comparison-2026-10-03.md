# TIQ and TennisRecord comparison — October 3, 2026

TIQ network 1.1 was compared with 1,405 players whose dated TennisRecord estimates could be tied to the matched owner profile and a usable TIQ network result. Of these, 851 were in Missouri. The audit reconstructed TIQ through each TR measurement date using the retained current-season court graph; it did not compare an older TR estimate with a newer TIQ result or add 0.5 to TR.

The replay contained 54,112 usable courts and published network estimates for 42,964 players. The paired sample is limited to available archived estimates, not all players or a representative sample. Unresolved identities, non-owner estimates and players without a supported result by the measurement date were excluded.

## What the comparison shows

Overall rank correlation was 0.957. This is agreement in ordering, not 95.7% accuracy. Different published playing levels contribute heavily to that result. Within the larger individual C-level groups, rank correlations ranged from 0.65 to 0.74; the small 2.5 group was weaker.

| Dated C label reported by TR | Players | Median TIQ minus raw TR | Within-level rank correlation |
| --- | ---: | ---: | ---: |
| 2.5 | 28 | 0.378 | 0.332 |
| 3.0 | 281 | 0.415 | 0.653 |
| 3.5 | 406 | 0.399 | 0.676 |
| 4.0 | 312 | 0.457 | 0.743 |
| 4.5 | 125 | 0.506 | 0.721 |
| 5.0 | 16 | 0.541 | 0.774 |

These gaps describe different scales. They are not conversion factors and do not justify raising every TIQ rating. Nathan's same-date comparison was TIQ 4.592 versus raw TR 4.2931, a gap of 0.299, while the 4.5 group's median gap was 0.506. One player's gap should not set the scale for everyone.

Among the 1,168 paired players with usable dated C starting labels, 862 TIQ estimates were within that label's half-point display band, 112 were below it and 194 above. Those are starting-label comparisons, not official year-end outcomes.

After subtracting each player's published level, correlation was 0.42 for players with one or two usable courts and 0.74 for players with ten or more. This is descriptive evidence that match coverage matters; it is not a measured confidence probability.

## What changes next

The match-update formula remains unchanged. This comparison does not identify TR as ground truth or validate USTA bump/drop forecasting. Larger disagreements first need checks for missing source courts, incomplete lineups, identity holds, format mix and actual prediction performance.

That review found an import gap: 217 existing Missouri history pages had no current refresh enrollment. The old freshness audit checked queue existence and therefore missed them. The audit now checks current-season enrollment and a valid due date, reports held pages separately, and retains source pacing and review holds. Existing pages are repaired with the maintained enrollment helper and a queue backup.

The 1,405-player comparison is retrospective. Source publication timing can differ within a day, the retained match graph is not a frozen historical forecast, and the C labels are secondary reports through TR rather than independently verified official outcomes. USTA remains the official source for annual movement.

Local evidence: `network-1.1-tr-agreement.json`, `network-1.1-tr-disagreement-review.json`, `network-1.1-tr-coverage-trace.json`, and the before/after Missouri enrollment audits under `artifacts/rating-evidence/`.
