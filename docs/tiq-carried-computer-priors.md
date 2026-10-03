# Valid older computer starting ratings

TIQ network 1.1 uses the latest usable annual individual C label from the two preceding years. In 2026, this includes 2025 and 2024. The previous implementation admitted only 2025 labels, leaving some players with valid older labels to start from indirect network evidence.

USTA's 2026 regulations allow 2024 and 2025 computer ratings for players of every age; 2023 additionally requires the applicable age eligibility. We do not infer age from a player's league. See the [official 2026 regulations](https://ustasocal.com/adult/leagues/regulations).

Identity and owner-profile provenance checks still apply. Select the latest dated annual observation before testing whether it is an eligible C label: a conflicting, invalid or non-computer latest label blocks fallback. An older carried label must also agree with the current owner profile's C designation and level. Future-season, undated and three-year-old labels cannot initialize the model through this rule.

A carried C label starts at its TIQ band midpoint, like a newer C label. It does not impose a floor, ceiling, or annual movement prediction. Match updates, format separation and source-conflict exclusions are unchanged. TennisRecord's estimate is never used as the C label or converted by adding 0.5.

## Retrospective evidence

The October 3 audit found 2,256 additional guarded 2024-label candidates for 2026. None had newer pre-season or undated observations, or a conflicting current owner-profile label, in the available evidence. This is secondary source evidence, not independent official verification.

On the same 5,384 later 2026 research courts, game-share MAE changed from 0.143073 to 0.142960. Singles improved from 0.156057 to 0.155448; doubles from 0.141472 to 0.141420. The 2025 same-court later comparison was mixed: overall MAE changed from 0.151513 to 0.151560, while singles improved. These small differences do not establish annual forecasting accuracy.

Several large departures on few 2026 courts became less extreme: Dina Lowy's research doubles estimate changed from 4.463 to 3.640 and Tess Byler's from 2.222 to 2.726. These are offline research outputs, not claims about the latest live ratings or official USTA levels.

Evidence files are retained under the local `artifacts/rating-evidence/` directory: `carried-computer-prior-audit.json`, `carried-prior-supersession-audit.json`, and `carried-prior-assessment.json`. Frozen court inputs and shared-court comparisons distinguish added coverage from prediction changes.
