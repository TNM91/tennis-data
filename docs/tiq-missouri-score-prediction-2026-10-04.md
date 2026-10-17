# Missouri score prediction — October 4, 2026

The final read-only chronological replay of TIQ network 1.3 used 62082 usable courts overall and 9784 Missouri courts. Missouri courts require at least one matched Missouri source identity; 2058 identities were found. The final capture completed 2026-10-04T14:33:44.734Z.

The later comparison uses 940 courts from August onward. Expected game shares use estimates available before each day. The comparison baseline predicts a 50% share for each side. Lower mean absolute error is better; this is not rating accuracy or annual movement accuracy.

| Group | Courts | TIQ game-share MAE | Equal-share MAE |
| --- | ---: | ---: | ---: |
| All later courts | 940 | 0.138515 | 0.163391 |
| singles | 175 | 0.144676 | 0.181603 |
| doubles | 765 | 0.137106 | 0.159225 |
| All participants have dated priors | 359 | 0.137675 | 0.160163 |
| At least one inferred starting point | 581 | 0.139034 | 0.165386 |
| All have six earlier format courts | 394 | 0.127780 | 0.148513 |
| At least one has fewer than six earlier format courts | 546 | 0.146261 | 0.174127 |

Earlier evidence counts use all usable network courts in the same format from earlier days, excluding all same-day updates. Six courts is a descriptive subgroup cutoff, not calibrated confidence.

TIQ has lower error than the simple baseline in both formats, both prior-coverage groups and both evidence-volume groups. Starting-level subgroups use the band of average participant dated priors on fully anchored courts; they are not individual official USTA level cohorts. Several groups have small support and the 5.0 group has no courts.

This is a retrospective replay using currently reviewed source evidence, not an independently captured prospective test. Courts share players and are not independent observations. Eligibility for official year-end calculation remains separate. No production ratings or model parameters changed, and these results do not establish USTA bump/drop accuracy. Source reads occurred during active imports and are not transactional.

Evidence: artifacts/rating-evidence/missouri-score-prediction-2026-10-04.json and audit-missouri-score-prediction.ts.
