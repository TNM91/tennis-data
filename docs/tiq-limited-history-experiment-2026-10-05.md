# Limited-history prediction experiment — October 5, 2026

Keep the live prediction formula. A cautious adjustment for thin-history players did not improve the later evaluation period.

Compared nine alternatives that shrink predicted game share toward 50/50 when any player has fewer than 3, 6 or 10 earlier format courts. Shrink weights were 0.5, 0.75 and 0.9; the live output uses 1. Settings were chosen using 4,136 August courts, then evaluated on 1,987 September–October courts. Selection slightly favored weight 0.9 below three earlier courts.

| Later cohort | Courts | Live error | Candidate error |
| --- | ---: | ---: | ---: |
| All | 1,987 | 0.13920 | 0.13936 |
| Singles | 351 | 0.15234 | 0.15257 |
| Doubles | 1,636 | 0.13639 | 0.13652 |
| At least one player below six earlier courts | 1,418 | 0.14705 | 0.14726 |
| Previously frozen Missouri-linked cohort | 497 | 0.13870 | 0.13882 |

Error is mean absolute game-share error, not winner accuracy. The candidate worsened every required evaluation group, so it fails the release criterion. No live ratings or predictions were changed. The difference is small and does not establish that the live method is optimal; it supplies no justification for this adjustment.

This is an exploratory retrospective temporal split. Both periods were previously inspected in aggregate, so the evaluation is not an untouched prospective holdout. Missouri membership uses the earlier frozen court list and can omit later discoveries. This experiment changes prediction output only, not rating updates or annual USTA forecasting.

The input SHA256, candidate grid, selection rule, acceptance rule and results are recorded in artifacts/rating-evidence/limited-history-protocol-2026-10-05.json and limited-history-experiment-2026-10-05.json. The reproducible script is test-limited-history-forecast.mjs. Additional improvement work should examine stronger baseline comparisons, initialization quality, singles and ambiguous completion evidence with explicit temporal validation rather than assume that conservative forecasts are better.
