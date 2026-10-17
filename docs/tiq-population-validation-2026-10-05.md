# TIQ population validation — October 5, 2026

The live methodology has a useful score-prediction signal across the imported population. This audit replays 62,947 eligible 2026 courts chronologically, then evaluates 6,123 courts from August 1 through October 5. Scores from a court are not used to predict that same court. It is a retrospective replay with current reviewed source evidence, so this is not a prospective test or an annual USTA movement test.

## Results

Error is mean absolute error in predicted game share. A 0.140 error means an average difference of 14.0 percentage points in game share; it does not mean 86% match-winner accuracy. The comparator predicts a 50/50 share for every court and is intentionally simple.

| Cohort | Courts | TIQ error | 50/50 error |
| --- | ---: | ---: | ---: |
| All later courts | 6,123 | 0.1404 | 0.1623 |
| Missouri-linked later courts | 1,684 | 0.1333 | 0.1589 |
| Singles, all locations | 892 | 0.1551 | 0.1824 |
| Doubles, all locations | 5,231 | 0.1379 | 0.1588 |
| Every player has six earlier format courts | 1,208 | 0.1217 | 0.1450 |
| At least one player has fewer than six | 4,915 | 0.1450 | 0.1665 |

TIQ reduces average error by approximately 13.5% overall and 16.1% in the Missouri-linked cohort. This cohort includes any court with at least one matched Missouri source identity, rather than only courts played in Missouri. All observed starting-level groups with at least 90 courts outperform the simple comparator. The 5.0 group has only two courts and supports no useful conclusion. October has only eight courts and should not be interpreted as a monthly trend.

A paired bootstrap resampling 63 dates, 2,000 times with a fixed seed, estimates the average error advantage at 1.97–2.41 percentage points. Repeated players across dates and retrospective evidence limit statistical independence. Mean signed game-share error is -0.0011. Median absolute error is 0.1208; the 90th percentile is 0.2884.

## Outlier review

For the 20 largest prediction errors, all retained winning receipts agree with stored score tokens (allowing score reversal), every participant has exact primary source-key and side proof, and no canonical conflict is flagged. These checks support receipt consistency but do not independently prove real-world scores, score orientation, or match completion. The previously investigated abbreviated 6-1 1-0 court remains a completion-review concern; it is not automatically declared a retirement. No ratings or identities were changed in this audit.

## Operational check

The last eight observed scheduled ratings runs completed successfully about 15 minutes apart. The most recent completed at 11:49:57 UTC; a newer import requested recalculation at 11:59:22 UTC, consistent with ongoing ingestion.

The latest 15 observed import runs completed, processed 270 pages, and recorded zero source failures. Missouri still has 2,591 pending due refresh pages: 1,041 history, 1,160 player and 390 match pages. Another 64 match pages are in review. The oldest due pending page was due October 4 at 17:12 UTC. Pending discovery and repeated refresh work both contribute to this backlog; a successful job does not establish universal freshness.

## What this supports

Keep the current shared formula until a candidate beats it on a separately reserved chronological evaluation. Prioritize thin-history players and singles for the next candidate experiment, with Missouri reported separately. The observed difference between evidence groups is not a calibrated confidence score and does not justify assigning individual bump probabilities.

The official annual readiness audit still has eight reviewed ending-year labels and zero verified consecutive official annual starting/ending pairs. Match volume alone does not supply those outcome labels. No year-end USTA bump/drop accuracy is claimed. Current official designations stay separate from TIQ playing bands.

All new work was read-only in production. Reproducible local evidence lives in artifacts/rating-evidence: population-score-validation-2026-10-05.json, population-score-validation-rows-2026-10-05.json, population-validation-followup-2026-10-05.json, population-outlier-receipt-review-2026-10-05.json, missouri-backlog-current.json and official-usta/cohort-readiness.json.
