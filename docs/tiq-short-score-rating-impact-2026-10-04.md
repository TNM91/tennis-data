# Short-score rating history audit — October 4, 2026

## Findings

Of the 96 previously captured abbreviated-score candidates, 43 have stored TIQ snapshots involving 129 distinct players. This confirms rating-history participation, not that their present strength is wrong or a quantified downstream effect. No production records changed.

The earlier broad Missouri filter matched the Missouri Valley section, including Kansas, Oklahoma and Nebraska. Restricting to league names containing `Missouri Valley Missouri` gives 14 Missouri-state candidates. Seven have TIQ snapshots involving 13 distinct players. The seven are the prioritized internal evidence-review list in `artifacts/rating-evidence/short-score-rating-impact-2026-10-04.json`.

Among the broader section's reviewed winning receipts, none preserves an explicit retirement/default marker. Only one linked source page retained HTML. Re-parsing that page with the released marker-preserving parser gives the same `2-6 0-1` score for Singles 2 (Lisa Gil Diaz / Mary Dean), without an explicit incomplete marker. The page also contains ordinary completed courts and a valid three-token deciding-tiebreak score. The abbreviated court is not an artifact of dropping a third numeric set from the retained HTML.

## Decision and follow-up

Keep these courts under internal review. The evidence does not distinguish a retirement from a shortened format or incomplete source record, so do not invent a status or retrospectively relabel a player's rating. The released importer fix will preserve explicit status when supplied by subsequent source refreshes.

The next empirical model check is a sensitivity replay that excludes these ambiguous courts and compares subsequent predictions on common courts. Such a replay measures influence and the consequences of a proposed admission rule; it cannot establish that the underlying match was incomplete. A release decision must distinguish those two questions.

The audit checked the prior captured list, not newly discovered candidates. Snapshot and source evidence were queried during ongoing ingestion, without a transactional snapshot. Source-key provenance and retained pages remain internal; player-facing TIQ copy does not name the secondary source.

## Evidence

- `artifacts/rating-evidence/audit-short-score-rating-impact.mjs`
- `artifacts/rating-evidence/inspect-retained-short-score.ts`
- `artifacts/rating-evidence/short-score-rating-impact-2026-10-04.json`

Machine fields `missouriCandidates` and `missouriCourtsWithSnapshots` retain the broad section-filter results for traceability. Use `missouriState` for the corrected state-specific summary.
