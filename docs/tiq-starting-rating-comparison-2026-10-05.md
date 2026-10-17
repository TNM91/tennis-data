# Does match-history learning add value? — October 5, 2026

Yes, in this retrospective comparison: TIQ has lower game-share prediction error than a static starting-level model across all reported groups.

The comparison includes 2,571 August–October courts where every participant has a usable dated starting prior selected by the live model. All candidate courts retained complete participant and prior coverage. The static baseline averages starting levels by side and uses the same 1.6 game-share mapping as TIQ. A common +0.25 initialization offset cancels in the difference between sides. It never substitutes current player TIQ values for historical starting levels.

| Cohort | Courts | TIQ error | Starting-level error |
| --- | ---: | ---: | ---: |
| Overall | 2,571 | 0.1343 | 0.1526 |
| Singles | 527 | 0.1459 | 0.1748 |
| Doubles | 2,044 | 0.1313 | 0.1468 |
| Every player has at least six earlier format courts | 742 | 0.1213 | 0.1405 |
| At least one player below six earlier courts | 1,829 | 0.1395 | 0.1574 |
| Previously frozen Missouri-linked cohort | 447 | 0.1349 | 0.1549 |

TIQ reduces error by approximately 12.0% overall, 16.6% in singles, 10.6% in doubles and 12.9% in the frozen Missouri cohort. Error is mean absolute game-share error, not match-winner accuracy. August and September both favor TIQ; October has only four qualifying courts and supports no monthly conclusion.

This supports retaining chronological match-history learning rather than predicting solely from starting levels. It does not establish individual confidence, optimal model parameters, or USTA year-end movement accuracy. The comparator is a static starting-level model, not USTA's unpublished dynamic calculation. The cohort excludes players lacking dated priors and therefore is not representative of the whole book. Current evidence was loaded after the earlier prediction capture, so this remains retrospective validation; all 2,571 candidate courts still had usable priors at comparison time.

No production ratings or model parameters changed. Evidence and reproducible script: artifacts/rating-evidence/starting-rating-baseline-2026-10-05.json, starting-rating-baseline-rows-2026-10-05.json, and compare-starting-rating-baseline.ts.
