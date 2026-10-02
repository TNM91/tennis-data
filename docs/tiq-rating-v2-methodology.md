# TiQ band methodology v2 — implementation contract

Status: implemented experimental shadow engine (`lib/tiq-rating-v2.ts`); production ratings remain v1. The shadow engine does not write production ratings or publish annual probabilities.

## Player-facing scale

The proposed playing-strength display uses non-overlapping half-point bands: 4.50 <= strength < 5.00 reads as the 4.5 band; 5.00 starts the 5.0 band. Always classify from full precision, not a rounded label. A value rounded to 5.00 must not silently create a false boundary crossing. At the top of the supported scale, explicitly cap and label the top band.

Official USTA level remains a separate field. It is never derived from a TiQ display value. USTA's published dynamic band convention is upper-inclusive (a 4.5 band is above 4.00 through 4.50), whereas this proposed display convention is lower-inclusive. Therefore a simple +0.5 benchmark translation is illustrative at exact boundaries, not an official classification rule. Keep boundary convention and scale version in comparison exports.

TennisRecord 4.2931 translates to 4.7931 for visual comparison under the proposed offset. It must remain attributed to TennisRecord, with measurement and capture dates. It cannot initialize or adjust TiQ. Current v1 TiQ 4.412 is not an internal NTRP-style dynamic and must not be transformed blindly by +0.5.

## Initialization and evidence

An independently verified prior-season computer level L supplies a band prior, not an exact observed strength. Test the midpoint L + 0.25 on the display scale (equivalently L - 0.25 in the candidate calculation). A 4.5 player therefore has a proposed initial display of 4.75, not a promised recalculated result. Retain uncertainty and source/date/version provenance.

Self-rated, inferred, missing and appealed baselines need distinct evidence policies. Never substitute today's official level for a historical starting level. Missing or contradictory priors must remain explicit. The existing conservative diagnostic excludes affected matches; a future provisional-prior model requires separate validation rather than silently admitting them.

Rebuild from chronological complete matches, with consistent participants and source identity, duplicate reconciliation and score interpretation. Opponent and partner state must include preceding eligible history; isolated replay of Nathan's matches alone is not a calibrated counterfactual because opponents would be frozen or incompletely updated.

Maintain separate singles, doubles and overall playing-strength estimates. The new shadow engine has separate singles/doubles estimates for playing strength and the USTA-focused track, with overall weighted by processed format match counts. The older experimental annual band-center replay implements overall only. Neither is a validated production replacement.

## Movement and confidence

Use expected versus actual game share, taking both doubles teams into account. Test symmetric upward/downward score evidence. Replace v1's fixed annual-level downward floor with a validated prior/uncertainty mechanism; do not remove protection globally without a comparison. Match-volume confidence is not bump probability. Missing recent results, stale source dates and incomplete opponent histories must reduce evidence quality even when match count is high.

Replays must return a per-match explanation: date, source, eligibility policy, four participant identities when doubles, all pre-match estimates, actual and expected game shares, adjustment, post-match estimate, and exclusion reason. Persist methodology/config version and cutoff with every shadow result. No wall-clock-dependent weighting or future facts may enter an as-of forecast.

## Year-end forecast

The USTA-focused forecast consumes only section/year-eligible results. Missouri 2025 Tri-Level inclusion follows district rule 16(f). Dynamic-disqualification eligibility and year-end inclusion are distinct. Unknown policies, championship boundaries, appeals, DQ outcomes and mixed-only/tournament-only designations need explicit handling.

Train bump/stay/drop probabilities against independently verified annual outcomes. A playing-strength boundary crossing is evidence, not a guaranteed annual move. Use multiple seasons for tuning and a later untouched season for validation; hold out players/geographies where practical. Compare v1, v2, no movement and cutoff-safe TennisRecord estimates on the same cohort. Record exclusions and coverage to expose selection bias.

Report class support, bump and drop precision/recall, macro F1, Brier score, probability reliability and uncertainty intervals. Select numerical parameters and release thresholds before inspecting the final holdout. The current candidate K=0.18 and spread=0.12 are diagnostic constants, not trained parameters. There is currently no supported historical cohort establishing their accuracy.

## Rollout

1. Finish Missouri profile/history enrollment and verify freshness and result reconciliation.
2. Obtain verified historical starting/ending USTA levels and opponent priors, with exact championship-year and section policies.
3. Implement complete v2 format estimates and per-match explanation replay, writing only to versioned shadow storage.
4. Run Nathan and a sufficiently supported Missouri cohort through v1/v2 on identical full histories. Review causes of differences, not merely the final numbers.
5. Validate and calibrate on held-out outcomes. Publish the evidence limitations with the methodology.
6. Build the display adapter and update every dependent comparison, ranking, matchup and history view consistently. Preserve official level and source benchmark fields.
7. Snapshot v1 ratings and histories, publish a versioned v2 rebuild only after release review, and retain an independent rollback path. Incremental imports must then use the same v2 configuration as the rebuild.

The result for Nathan should contain official level 4.5 C, a newly calculated v2 playing-strength estimate, source completeness and per-match explanations. Until validation is sufficient, annual probabilities should be unavailable rather than invented. No v2 number is established by the proposed midpoint or the TennisRecord display conversion.

## Implemented shadow replay

`scripts/shadow-tiq-v2.ts` reads all available eligible canonical matches in the selected calendar window, not only the target's matches. It reads prior-season computer-label evidence with conflict exclusions and accepts an explicit independently verified override manifest. Every doubles update uses all four pre-match estimates. Evidence gains depend on an experimental shrinking variance; response and variance constants have not been trained or calibrated. Defaults do not constitute verified confidence.

The replay preserves source score text. For source-owned TennisRecord rows it may orient winner-first scores only when an exact, conflict-free winning source observation agrees with the score and declared winner. Already usable court-side scores are retained. Original and processed scores, observation identity, expected/actual game shares and pre/post estimates are included in target explanations. Current production's conservative win/loss fallback and snapshots are untouched.

The read-only same-evidence comparison starts v1 and v2 from identical annual labels and feeds identical accepted courts, with no future-relative recency. Native v1 numbers are explicitly identified; they are not mapped blindly to v2. Full input graphs are retained locally with a capture timestamp and evidence hash; `--input` enables offline repeatability. Local evidence is not committed or exposed publicly.

```powershell
node --import tsx --env-file=.env.local scripts/shadow-tiq-v2.ts '--player=Nathan Meinert' --season=2026 --cutoff=2026-10-02
node --import tsx scripts/shadow-tiq-v2.ts '--player=Nathan Meinert' --season=2026 --cutoff=2026-10-02 --input=artifacts/rating-evidence/tiq-v2-input-2026-2026-10-02.json --out=artifacts/rating-evidence/offline
```

Initial October 2 source-oriented replay: 70,266 available canonical records, 29,448 processed courts across the network. Nathan's 4.7333 overall shadow estimate used seven singles and one doubles result. His other twelve courts lacked supported participant priors; five further target-associated records were team summaries, not courts. This incomplete cohort cannot establish his final v2 rating or year-end forecast. His live v1 overall remained 4.412. The report explicitly keeps `releaseEligible=false` and annual probabilities null.
