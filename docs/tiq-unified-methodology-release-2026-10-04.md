# Unified current TIQ publication — October 4, 2026

## Intended behavior

Current TIQ uses one network methodology. All current-season TIQ snapshots come from that calculation, including players previously left on legacy fallback. An unrated format receives a provisional starting estimate. An unresolved identity without admitted network results is under review. The server default is network regardless of environment; legacy is an explicit audit/test override.

Player publication includes model, season, status and separate singles/doubles court counts. Profiles and the player directory label these states; reviewed or not-yet-published values are suppressed in the profile's numeric displays. An overall estimate can be current from doubles while singles remains provisional. Older-season history and the separate USTA track are preserved.

Provisional seeds use the model's prior offset (+0.25), preferring usable dated starting evidence, otherwise the stored baseline, bounded to 1.5–7. These are starting estimates, not validated current strengths. Review seeds are not shown as current profile estimates. The existing game-share response formula is unchanged. No annual USTA movement accuracy is inferred.

## Read-only full-data audit

82,131 players: 45,500 current, 35,762 provisional, 869 review. 442,336 current-season TIQ history rows; zero legacy-format TIQ rows in the desired output. Michael Ho: doubles/overall about 4.644 from 31 doubles courts; singles 4.25 provisional, with zero eligible singles courts. These are dry-run results, not a completed live rollout.

## Release state and order

Draft PR: https://github.com/TNM91/tennis-data/pull/1480. Focused calculation/publication tests passed (94); targeted lint and type checking passed. Full hosted verification passed for final commit `4624799b397da9e1f94148114823ac15e870d55d` in run 37219698543: tests, lint, type checking, production build, schema audit and captain weekly continuity. Preview build succeeded. The Supabase browser session expired; database sign-in is required before applying the additive migration. The migration, data-backed preview smoke check, merge, deployment and live replay remain pending. Do not merge before schema readiness and preview verification.

1. Apply `supabase/migrations/20261004000100_add_tiq_rating_evidence.sql` through the authenticated database editor and verify the five columns.
2. Finish full CI and preview checks, then merge and verify the production deployment.
3. Run the existing full network replay with compact result reporting.
4. Verify model/season/status counts, zero retained current-season legacy TIQ rows, and current/provisional/review profile and directory displays.

## Rollout continuation

GitHub sign-in retry succeeded. The additive migration executed successfully in the production SQL editor; all five columns were independently verified through REST. The preview loaded Michael Ho's real record and correctly labeled missing publication metadata as awaiting refresh. PR 1480 merged as `fbfc098f4087ef24670e5575ea05ce8db2ab2d28`. Production deployment `dpl_EHY5DE1uKWXSMH7A1b1VpYe54Lfs` is READY with www.tenaceiq.com assigned.

The full live replay completed under its own shared ratings lock using `replay-unified-tiq.ts`, with compact result reporting. Run `82027a52-3272-4e40-b073-35c2e7c3980d` completed at 20:35:22 UTC. Independent REST verification found all 82,132 players published on tiq-network-1.4 for 2026: 45,501 current, 35,762 provisional, 869 review. Zero current-season legacy TIQ history rows remain; 14,150 stale managed snapshot rows were removed. The script did not rewrite the earlier failed Michael Ho run or clear that run's pending request.

Live values: Nathan Meinert overall 4.646, singles 4.664, doubles 4.633 (8 singles and 11 doubles courts). Michael Ho overall/doubles 4.648 (31 doubles courts), singles 4.25 provisional (zero eligible singles courts). Production browser verification confirmed Mike's provisional singles label and existing membership masking. Evidence: `unified-tiq-live-replay.json` and `unified-tiq-live-verification.json` in artifacts/rating-evidence. Annual USTA movement forecasting is still not independently validated.

Read-only audit evidence: `artifacts/rating-evidence/unified-tiq-dry-run.json`. Previous Michael Ho identity repair is separate and already live.
