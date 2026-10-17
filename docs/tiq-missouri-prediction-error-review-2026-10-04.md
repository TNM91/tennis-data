# Missouri prediction error review — October 4, 2026

## Decision

Keep the live TIQ network 1.3 methodology unchanged. This review made no production writes. Moving predicted game shares toward 50/50 did not improve the selection-period results.

The captured Missouri cohort contains 9,808 courts with at least one participant linked to a Missouri source profile. June–July provides 1,890 selection courts; August onward provides 940 evaluation courts. This is an exploratory temporal comparison within a previously examined season, not independent validation of annual USTA movement.

## Forecast adjustment experiment

Candidate forecast = 0.5 + weight × (live forecast − 0.5). These adjustments affect forecast output only; they do not replay different strength updates.

| Weight | June–July mean absolute game-share error |
| --- | ---: |
| 0.50 | 14.06 percentage points |
| 0.75 | 13.50 percentage points |
| 1.00, current behavior | 13.27 percentage points |

The unchanged weight won selection. Its later error was 13.85 percentage points overall, 14.47 for singles and 13.71 for doubles. Courts with at least one participant having fewer than six earlier same-format courts had 14.63 points of error. Earlier-court counts exclude same-day results.

## Twenty largest later errors

All twenty courts agreed with retained winning score receipts. Every participant had an exact primary source-key receipt on the expected side. None of these receipts was marked conflicting. This establishes internal agreement, not independent verification of the real-world result. Large errors alone are not grounds for deleting results or changing identities.

One court deserves a completion-status review: September 27, Allison Morris versus Celine Edstrom, canonical court `2d31e8f6-fa14-4622-9ff4-de29f07a711d`, score `6-1 1-0`. The parser treats `1-0` as a match tiebreak and calculates game share from the first set alone (6/7). The retained score agrees, but this score does not establish a conventional completed best-of-three match. Current admission rejects explicit retirement/default text; an abbreviated score without that text can still be admitted.

Do not automatically classify this as a retirement: confirm retained completion status and the competition format before changing eligibility. A format-aware completion check, tested against valid short formats and deciding tiebreaks, is a concrete next methodology improvement to investigate.

### Completion follow-up

The broader October 4 capture contains 142,546 canonical courts dated January 1 onward. Ninety-six have exactly two score pairs, one regular set reaching six games and one `1-0` or `0-1` token; 28 have Missouri in their league name. These are review candidates, not 96 proven invalid rated results: the capture includes courts with no recognized match type and does not restrict to network admission. It also does not deduplicate separate canonical records of the same real-world court.

The example was traced through its winning observation to the staged court. Both retain `6-1 1-0`; neither provides a completion/retirement field. The stored page supplied no usable matching HTML context. Therefore the available evidence does not establish whether it was a retirement, a truncated score, or an unusual scoring format. No player or result was relabeled, removed or recalculated from this uncertain classification.

The improvement specification is to preserve explicit court completion status and scoring format during ingestion, then apply completion-aware rating admission. For ordinary best-of-three play, a single completed set followed by `1-0` must not be assumed to be a completed deciding tiebreak. A legitimate deciding match tiebreak requires two preceding sets split between the sides; other competition formats require their own explicit format rules. This should be tested with completed straight sets, split sets with deciding tiebreaks, reversed winner-first scores, retirements and legitimate shortened formats before release. Retained scores remain unchanged.

Follow-up machine evidence: `artifacts/rating-evidence/short-score-completion-2026-10-04.json`.

## Evidence

- `artifacts/rating-evidence/mo-prediction-review-protocol-2026-10-04.json`: candidate protocol written before evaluation.
- `artifacts/rating-evidence/mo-prediction-review-frozen-2026-10-04.json`: captured Missouri prediction rows.
- `artifacts/rating-evidence/mo-prediction-error-review-2026-10-04.json`: selection, evaluation and outliers.
- `artifacts/rating-evidence/mo-outlier-receipt-review-2026-10-04.json`: exact score/participant receipt checks and frozen-input checksum.

Source ingestion continued during capture; this is not a transactional database snapshot. Courts share players and are not independent samples. No confidence interval, annual movement accuracy or calibrated bump probability is claimed. Secondary-source receipts remain internal research evidence and are not exposed in player-facing methodology.
