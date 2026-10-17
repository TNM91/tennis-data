# Import freshness and year-end forecasting audit

Read-only production inspection on October 2, 2026, approximately 08:35 CDT. No production settings, queues, or ratings were changed. The local checkout contains extensive pre-existing changes, including importer and rating changes; local code findings are not proof of the deployed implementation.

## Importer

The collector is enabled, in national bootstrap mode, and also completing weekly checkpoints. A weekly checkpoint ending at 08:29 CDT promoted 36 courts, with six parser failures out of 18 attempted pages. A rating job completed at 08:22 CDT; another was running at inspection. The collector is working, but refresh coverage is incomplete.

The repeatable evidence audit counted 24,911 current-season queue pages: 11,764 refreshed in the preceding seven days, 1,052 completed pages overdue, 11,631 pending pages overdue, and 464 review holds. There were 47,594 pending pages across the queue. Counts are nontransactional and change as ingestion proceeds. Refreshing a page does not prove every result was parsed and promoted.

Nathan Meinert's 2026 history page was refreshed September 26 at 10:09 CDT and is due October 3 at 10:09 CDT. His profile queue entry has no refresh season or due date. His staged profile metadata was last touched September 26; metadata touches can come from match-page processing and do not prove a fresh profile fetch. No 2027 history URL was found in his queue. September fall matches in the canonical database belong to a 2027 Adult league, making championship-year coverage a concrete concern. His recent September courts came from captain scorecards; the most recent TennisRecord-origin court in the retrieved August/September records was August 17. Active/rating eligibility was not inspected in that individual match query; retired duplicates must not be counted as active evidence.

The earlier current-refresh migration seeds calendar-year Missouri competitions. Production now has national current-season rows, so that migration alone does not describe the live scope. Inspect deployed queue preparation before changing it.

Repair priorities: establish repeatable profile refreshes, cover active championship seasons including upcoming-year fall leagues, measure overdue age by region and page kind, and inspect the specific held source pages. Preserve identity and winner review holds. Do not increase source request pressure or release holds indiscriminately.

Direct source comparison remains unverified: the public page failed web retrieval and local HTTPS retrieval failed certificate validation. No TLS validation was disabled.

## Rating evidence

The audit read 68,626 linked NTRP observations. Annual December 31 computer labels cover 59,950 players, with 57,084 player-year entries for 2025 and 2,394 for 2024. There are 771 conflicting player-years, which were excluded from transition counts. Consecutive, unambiguous 2024-to-2025 transitions total only 87: 29 up, 31 unchanged, 27 down. These are source-reported labels, not independently verified USTA outcomes, and their effective-date convention needs validation. This cohort is too small and potentially selected to claim national forecasting accuracy.

TennisRecord estimated ratings exist on 67,865 staged player records. They are metadata, separate from our rating calculation. They are not a historical estimate time series: the service preserves a previous estimate when a later page supplies none, while updating the generic last-seen timestamp. Therefore that timestamp cannot establish the estimate's measurement date. Nathan's stored estimate is 4.3075; current TiQ and USTA-track overall values are both 4.412, against a stated 4.5 C baseline. The 0.1045 difference is descriptive only: freshness and scales are not aligned.

## Methodology findings

USTA describes 3.5 as a band from 3.01 to 3.50, uses scores and partner/opponent ratings, and defines a championship rating year whose ending date varies. Adult, Mixed-exclusive, tournaments, and section-specific eligibility require separate handling. Source: https://www.usta.com/en/home/play/adult-tennis/programs/national/usta-ntrp-ratings-faqs.html

The inspected local engine starts every player's dynamic rating at the displayed level, rather than an estimated position within that level. A 4.5 published level therefore becomes a 4.5 starting dynamic rating. This scale assumption must be calibrated before mapping values to USTA movement thresholds.

The verified/inferred baseline guard prevents decline for the first 12 processed matches and eventually caps decline at 0.20. This asymmetric restriction can suppress drop-down evidence. It is not an empirically validated year-end movement model. The existing cohort script calls a move-up signal near the next half-point; that convention is not directly comparable to USTA's published dynamic bands.

Historical replays initialize from the current player baseline and compute recency relative to the latest loaded match. Using those replays as past forecasts would introduce future information. The engine also applies inactivity decay; its contribution must be tested separately for USTA forecasting. A USTA-only source track is not automatically an official-eligibility or year-end forecast model.

## Required comparison design

1. Build independently validated annual starting and ending labels, with C/S/A/M/T/D designations, championship season, identity confidence, and unresolved conflicts excluded. Expand paired historical labels beyond the 87 available transitions.
2. Recompute forecasts at historical cutoffs from baselines and matches available for that cutoff. Do not use current baselines, later opponent outcomes, or future recency anchors. Retrospectively recovered source facts must be distinguished from contemporaneously archived evidence.
3. Archive TennisRecord estimates with their actual source capture date and season. Compare both models on identical players and cutoffs; current metadata cannot establish a historical TennisRecord benchmark.
4. Evaluate a calibrated score-based model, the existing engine, and a no-movement baseline. Test band-center initialization, removal/softening of the downward guard, partner adjustments, eligibility, and championship effects as separate variants.
5. Train on earlier seasons, tune on a separate season, and hold out the latest completed season. Add geographic holdouts and prevent a player's repeated observations from inflating confidence.
6. Report up/stay/down precision and recall, macro F1, confusion matrices, Brier score and probability calibration, with player-level confidence intervals. Overall accuracy alone rewards predicting everyone stays. Report coverage and freshness beside performance.
7. Release a versioned probability forecast only after held-out improvement. Preserve a general playing-strength rating separately. For 2026, save forecasts now and score them after verified year-end outcomes become available.

The audit establishes importer gaps and calibration risks; it does not establish either model's year-end predictive accuracy or justify a production rating rebuild.

Evidence: `artifacts/rating-evidence/audit-2026-10-02T13-34-40-211Z.json`. Re-run with `node --env-file=.env.local scripts/audit-year-end-rating-evidence.mjs`; this performs database reads and writes only an aggregate local report.
