# TIQ rating methodology

TIQ estimates how strongly you are playing from your match results, the players across the net, and your doubles partners. Your official USTA rating stays separate. TIQ helps you understand your level and direction of play; USTA determines your official level.

This methodology is live for current-season players with usable network evidence. The network calculation launched October 2, 2026; version 1.1 added valid carried computer starting labels on October 3. Version 1.2 restores individually proven source-owned courts when a shared name created an identity hold. Players without usable network evidence retain their existing estimates. TIQ publishes estimated playing strength; it does not publish validated year-end USTA movement probabilities.

## What the three ratings mean

| Rating | What it tells you |
| --- | --- |
| USTA level | Your official published playing level and designation, such as 4.5 C. |
| TIQ strength | An estimate of your playing strength based on the results TIQ can use. |
| TennisRecord estimate | A separate outside estimate used to compare systems. |

A USTA label copied from TennisRecord is recorded as a secondary source. It is kept separate from TennisRecord's estimated strength. An old published label does not establish that a player stayed at that level in a later year.

## How to read the TIQ number

The improved TIQ display uses the lower end of each half-point band:

| TIQ strength | TIQ playing band |
| --- | --- |
| 3.50 to below 4.00 | 3.5 |
| 4.00 to below 4.50 | 4.0 |
| 4.50 to below 5.00 | 4.5 |
| 5.00 to below 5.50 | 5.0 |

A TIQ strength of 4.63 sits in the 4.5 band. A strength of 4.95 sits near its upper end. At 5.00, the estimate enters the 5.0 band. Band placement uses the full underlying value, before display rounding.

These are TIQ display bands. Their boundaries are not official USTA dynamic-rating thresholds.

## How the estimate is calculated

1. **Establish a starting point.** The model uses the latest usable individual C label from the two preceding years, after checking identity and source ownership. In 2026, that includes 2025 and a still-usable 2024 label. An older label must still agree with the current owner profile; a conflicting newer label blocks fallback. Three-year-old labels require age evidence and are not admitted by this rule. The model starts at the middle of the label's TIQ band: 4.5 begins at 4.75. This is an initialization assumption, not knowledge of the player's unpublished USTA dynamic rating.

2. **Handle missing individual ratings.** The model uses existing estimates of players on the same court to infer an unknown player's starting strength. The live model also uses a suitable individual Adult division as context. It blends 75% division midpoint with 25% existing lineup mean for initialization. Combined team levels, Mixed, Combo, Tri-Level, and tournaments do not supply this individual division context. A division is never recorded as the player's official rating. If no player on a court connects to an existing anchored estimate, that court cannot start a rating on its own.

3. **Estimate the expected result.** In singles, the model compares the two players. In doubles, it compares the average estimated strength of each pair. It estimates the share of games each side should win.

4. **Compare the actual score.** Winning a larger share of games than expected pushes strength upward. Winning a smaller share pushes it downward. A close loss to stronger opponents can improve an estimate; a win that falls short of expectations can lower it.

5. **Update chronologically.** All courts on the same day use the estimates available before that day's results. Their updates are applied together afterward. Future results cannot change an earlier prediction.

6. **Keep singles and doubles separate.** Each format has its own estimate. The overall estimate averages those strengths in proportion to the usable courts in each format. It is an overall playing-strength summary, not a USTA calculation.

The October 3 comparison covered 1,405 players, including 851 in Missouri, with TIQ reconstructed through each TennisRecord estimate date. Overall rank correlation was 0.957, but this is agreement in ordering, not 95.7% accuracy. Within the larger C-level groups, correlations were 0.65–0.74. Median TIQ-minus-raw-TR gaps varied from 0.378 at 2.5 to 0.541 at 5.0; they are descriptive differences between scales, not conversion factors. The [comparison report](tiq-network-comparison-2026-10-03.md) gives the sample sizes and limits.

That review also found 217 existing Missouri histories missing current refresh enrollment. The queue was backed up and repaired with the maintained enrollment helper. The strengthened audit verified zero enrollment or scheduling gaps across 2,854 expected histories for 1,427 known profiles. It now distinguishes a page merely existing from a page actually scheduled for refresh. Those pages still require normal source collection; enrollment alone does not make their data fresh.

The size of an update depends on the score surprise and the model's internal uncertainty. That uncertainty is a calculation input; it is not a measured probability that the rating is correct. No additional recency weighting or repeated-partner discount is enabled in the reference configuration.

## Which results count

Research inputs must pass checks for player identity, complete lineups, dates, score interpretation, and the selected analysis window. Duplicates and unresolved conflicts are excluded. Defaults, walkovers, retirements, and unusable scores do not enter this replay.

A match that helps describe playing strength may still need separate review before it supports a USTA year-end forecast. Eligibility depends on the applicable competition rules. More imported matches help only when the correct players and results are attached.

## What a movement signal means

Read movement as a direction to watch. Sustained performance near the upper end of your current TIQ band suggests stronger play; sustained performance above it suggests that the next band may describe your play better. The same principle applies downward.

One result or one boundary crossing is insufficient to predict a USTA change. Look for a pattern across playing days, opponents, and doubles partners. An inferred starting estimate deserves less certainty than one supported by the player's dated individual rating. More matches alone do not guarantee a better estimate.

The live model does not publish bump or drop probabilities. TIQ strength should not be presented as an official next-year rating.

## Nathan Meinert example

Nathan's independently checked official label is 4.5 C, dated December 31, 2025. On the reviewed research dataset, the frozen reference estimates his strength at approximately 4.64. With the optional division-context setting, the estimate is approximately 4.63. Both sit in TIQ's 4.5 band.

The published live calculation currently gives Nathan 4.60 overall, 4.67 singles, and 4.54 doubles after his confirmed September 30 USTA court was imported. The live graph differs from the research graph where source-recovered courts remain outside the canonical match book. These are playing-strength estimates, not a prediction that USTA will bump him. TennisRecord's separate estimate is a comparison point. Adding 0.50 to TennisRecord is a proposed display convention, not a verified conversion between rating systems.

## How TIQ improves the method

Judge playing strength by how well it predicts later match results. Judge year-end forecasts separately against actual annual labels. Compare each change with simple baselines on the same players, retain changes that help across seasons, and inspect errors by level, format, geography, and available history.

The optional division initialization improved later-match prediction in both reviewed seasons. It also improved ending-level agreement, but still trailed a simple individual-division baseline. That makes it useful research progress, while keeping the player-facing interpretation focused on estimated strength and sustained direction of play.

## Baseline provenance and population audit

A numeric baseline alone does not establish an official USTA level. Profiles marked unknown or inferred show USTA pending; self-rated profiles retain their self-rated context. Only a baseline explicitly marked verified supplies the displayed USTA comparison. That source flag is separate from proof that the label is current. Annual comparisons additionally require the label date, designation, and an unambiguous matching source identity.

The October 2, 2026 population audit covered 81,971 persisted player records, including older fallback estimates. Of 729 ratings at least one point from the stored baseline midpoint, 721 had self-rated, inferred, or unknown baseline sources. The eight remaining verified-source examples had only December 2023 or December 2024 C labels available. Their mismatch against a historical label does not establish a prediction error.

The stricter cohort contained 55,200 players with source-identity-guarded C labels dated December 31, 2025, reported through TennisRecord. Of these, 49,021 (88.8%) had persisted TIQ estimates within that label’s half-point band. This includes fallback estimates and is a descriptive alignment check, not independent USTA verification or a year-end forecast success rate. A live import can change row counts during these read-only paginated audits.

## Later-match prediction check — October 3, 2026

The unchanged live network configuration was replayed chronologically on the frozen research book, including reviewed recovered courts that are not all in the live canonical book. Predictions use only preceding-day states. The August-and-later diagnostic covers 20,445 courts in 2025 and 5,384 in 2026. These seasons were previously inspected during development, so this is a retrospective diagnostic rather than untouched prospective validation.

Mean absolute game-share error was 15.15 percentage points versus 16.66 for an even-match baseline in 2025, and 14.31 versus 16.26 in 2026. Singles and doubles each beat the even-match baseline in both seasons. On the common 2026 subset of 2,059 courts where every participant had a dated individual prior, TIQ error was 13.65 points versus 15.49 for a static prior-only prediction. No all-prior 2025 comparison was available after source identity guards.

Singles had larger absolute errors than doubles in both seasons. In 2026, courts furthest from dated anchors had 16.00-point error versus 13.65 for courts where everyone had a dated prior. These findings support retaining the current strength method while prioritizing evidence coverage and format-specific validation. They do not justify increasing ratings across the board, capping estimates at an official label, or publishing annual bump probabilities.

## Singles evidence and conservative prediction probe

In the retrospective 2026 later-match singles cohort, mean absolute game-share error was 15.05 percentage points on 320 courts where both players had dated priors, versus 16.26 on 271 courts with at least one inferred starting point. Both groups beat the even-match baseline. This supports improving individual evidence coverage rather than raising or lowering all singles ratings.

A fixed exploratory adjustment moved predicted game shares 20% closer to an even split, without changing replay states or live ratings. It reduced squared error in both formats in both seasons, but mean absolute error increased in 2026: singles from 15.61 to 15.73 points and doubles from 14.15 to 14.18. The adjustment is not deployed. It is a post-processing probe on previously inspected data, not a tested replacement for the rating update model.

## Missouri discovery and refresh enrollment

When the enabled collector parses a profile with explicit Missouri state evidence, it enrolls the source profile and its active championship-year histories in Missouri weekly refresh after settling the current source claim. During fall, enrollment includes the current and next championship years. This applies to Missouri profiles found through national crawling as well as the Missouri campaign. Source identity parameters remain intact; running jobs and review holds are not transferred, and existing current-season due dates are preserved.

Enrollment places the pages into the normal paced collector. It does not promise immediate source publication, complete statewide discovery, or instantaneous processing of new histories.

## Update-response robustness check — October 3, 2026

The live response multiplier of 3 was compared with less reactive alternatives of 2.25 and 1.5 on the same frozen source-reviewed match graph. June-July average absolute game-share error across the two seasons selected 2.25 by a very small margin. That choice was then assessed on August-and-later courts: error fell slightly in 2025 but increased in 2026 for both singles and doubles. A response of 1.5 worsened both later-season cohorts. The current multiplier of 3 remains in use.

This is an exploratory retrospective check, not untouched prospective validation. A parameter change must improve later predictions across seasons and the intended formats; a small aggregate gain cannot compensate for worsening another season. Stored official USTA labels, TIQ ratings, and year-end forecast availability are unchanged by this offline check.

## Reading rating history — October 3, 2026

The player profile's rating history count describes unique matches with a stored TIQ rating result in the current calendar year and selected format. Overall, singles, and doubles have separate counts. Stored results can include fallback estimates, so this count is not a network-only evidence measure or a probability that the estimate is correct. Lifetime match history remains useful for records and performance, but it does not establish rating confidence.

Nathan's current profile has 17 overall rated results in 2026, with 8 singles and 9 doubles, compared with 68 lifetime tracked matches. A published-level band comparison requires a verified USTA baseline. Self-rated, inferred, or unverified baselines show “USTA comparison pending” rather than an above/below judgment.

The October 3 importer check found all 217 repaired Missouri histories still enrolled but awaiting collection. Source timeouts activated the existing cooldown until 12:16 p.m. Central; retained-page processing continues during that pause. Successful retained-page batches do not mean a new source capture has been fetched.

## Repeated doubles partner check — October 3, 2026

The current method gives usable courts their normal update weight even when a doubles partner repeats. Discounts of 25% and 50% for a previously seen partner were tested on the same frozen chronological research graph. Both discounts increased average doubles prediction error in both seasons, in the June-July comparison and across 23,986 August-and-later doubles courts. Singles predictions remained unchanged. The live repeated-partner weight therefore remains 1.

This result supports the current score-prediction setting; it does not mean repeated pairings are independent evidence about each individual. Partner variety remains relevant when interpreting how well an individual estimate is supported. No confidence percentage or USTA annual movement probability is inferred from this test.


## Source ownership and live verification — October 3, 2026

A shared name does not establish that two source profiles belong to one person. A held court can count when its single conflict-free winning receipt contains a complete source lineup and places each held participant's exact primary profile key on the correct side. Scores must match the retained evidence, including a verified winner-first orientation. Missing ownership, other profile keys, changed scores and ambiguous evidence remain excluded. Conflicting profile labels still cannot supply starting ratings.

Version 1.2 is deployed and its protected production rebuild completed at 20:11 UTC. It used 61,401 courts for 45,396 network players. Nathan's published values are 4.592 overall, 4.666 singles and 4.525 doubles. His official USTA level remains separate at 4.5 C.

A controlled replay restored 7,218 usable courts. Later-match game-share error improved slightly in both formats; this does not validate annual USTA movement predictions. Phyllis Norman now publishes 4.980, and Anne Hope 5.063. These estimates follow usable match evidence and are not forced toward an outside rating. Unsupported courts remain held.

Release verification passed 3,258 tests, lint, typecheck, production build, schema checks and captain continuity. The production rebuild completed in 285 seconds, within the scheduled 300-second limit but with limited headroom. A verified rollback backup and live verification receipt are retained in artifacts/rating-evidence.

## Keeping published history current

The scheduled engine still replays match evidence chronologically. Publication now keeps identical stored results, saves new or corrected results, and removes stale TIQ courts from the published network scope after successful writes. A date, score or starting-evidence correction can change later results and trigger their updates. This improves how history is published; it does not alter the rating formula or establish official USTA movement probabilities.

The October 3 repair restored 436,556 missing history rows after the previous full-rewrite path timed out. Verified production history is complete again at 954,638 current/future rows. A repeat protected rebuild completed in 178 seconds without rewriting any history rows. Details are in tiq-rating-history-diff-release-2026-10-03.md.

## Deciding tiebreaks and current live version — October 3, 2026

TIQ network 1.3 is now live. When two regular sets are split, a deciding tiebreak recorded as 1–0 can establish that a proven TennisRecord winning receipt uses winner-first score order. We orient that score to its actual player sides before estimating performance. The tiebreak identifies the winner but adds no regular games to game share. Exact receipt and source-ownership checks still apply; ambiguous namesakes remain held.

The verified scheduled rebuild completed in 197 seconds and used 61,680 courts for 45,417 network players. All 956,496 expected current/future history rows are present. Nathan's current published TIQ values are 4.602 overall, 4.667 singles and 4.545 doubles; official USTA remains 4.5 C. Earlier numbers above describe earlier releases. TIQ estimates are not calibrated annual USTA movement probabilities, and no universal TennisRecord offset is applied.

The same-graph later-match comparison improved slightly in doubles and worsened slightly in singles. This is an evidence correction, not proof of improved forecasting in every format. Full details and remaining Missouri ownership gaps are in tiq-deciding-tiebreak-review-2026-10-03.md. TennisRecord fetching has recovered, but some enrolled histories remain overdue.

## Annual movement evidence audit — October 4, 2026

A fresh audit found 83 apparent 2025 transitions at the canonical-player level, but zero consecutive annual pairs on the same staged source profile. The eight reviewed official ending labels also lack verified official prior annual ratings. Those apparent transitions are excluded from movement validation. Annual bump/drop accuracy remains unmeasured; existing current playing-strength ratings remain live. The admission rules and evaluation specification are documented in tiq-year-end-backtest-2026-10-04.md.
