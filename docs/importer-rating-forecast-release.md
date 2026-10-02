# Importer refresh and rating forecast implementation

## Delivered changes

Recurring refresh now includes verified owner profile URLs and both the current and next championship year's history during August–December. Identity parameters from the original profile URL are retained. Missouri boundaries and existing review holds remain enforced. Current checkpoints reserve opportunities for history, profile, team/directory and scorecard pages, ordered by refresh due date. Historical opportunities, source pacing, active-run locks and request ceilings are unchanged.

An additive estimate archive preserves the source page, immutable capture timestamp, estimate measurement date and explicitly stated TennisRecord projected level, when available. Current metadata is not used as a historical benchmark. Annual-label candidates retain conflicting evidence and explicitly expose which player-years must be excluded.

The separate experimental forecast replay compares the existing engine with band-center initialization and symmetric score movement, without the playing-strength engine's downward floor. Replays initialize from prior-year annual labels, exclude later matches and unconfirmed match eligibility, and avoid future-relative recency and inactivity. The existing production rating calculation is unchanged apart from exporting its singles processor for reuse.

Comparison reports include class-specific precision/recall, macro F1, confusion matrices and Brier score against a no-movement baseline. TennisRecord comparisons use identical players and cutoff-safe archived estimates. Verified USTA outcome manifests can override lower-authority source labels. No candidate is release eligible until trained and validated on adequate independent seasonal and geographic holdouts.

## Live work completed

Nathan Meinert's profile and 2026 history were refreshed on October 2, 2026. The new capture shows 20 matches and a 4.2931 estimate measured September 30, versus the stale 17 matches and August 23 estimate. His missing 2027 history was enqueued. Prior queue rows were backed up in `artifacts/rating-evidence/player-refresh-2026-10-02T14-18-23-162Z.json` in the original checkout.

Fresh completed history identifies September 13 and 20 scorecards under championship year 2027 that production discovery excluded. Both were enqueued. The September 14 scorecard was captured August 29, before its scheduled play, and held for lacking results; it was conditionally returned to pending using fresh completed-history evidence. Backup: `artifacts/rating-evidence/history-discovery-repair-2026-10-02T14-53-13-972Z.json`. These repairs request normal source fetching and reconciliation; they do not promote incomplete courts or rebuild ratings. The code now schedules complete upcoming events without court results for another weekly capture instead of permanently holding them.

## Diagnostic results

The January 1–October 1, 2025 diagnostic reconstructed 2,716 loaded courts across players with known prior-year labels. The 87 paired source-reported annual transitions yielded zero players with enough fully supported match evidence. There are 771 conflicting player-years. This partial window is not the verified USTA championship year and does not establish forecast accuracy. The evidence gap must be filled with independently verified annual starting/ending levels and opponent priors; current levels must never substitute for historical priors.

The diagnostic's `releaseEligible=false` is intentional. Parameters and probability spread are experimental. Full-year boundaries, section eligibility, training/calibration, confidence intervals and holdouts remain prerequisites. Historical TennisRecord comparison is unavailable until genuinely dated archives exist. The new archive starts fixing that prospectively; it cannot recreate past estimates from today's metadata.

All 464 current-season review pages were inspected from retained source evidence. Of these, 459 contain no complete courts under the current validated parser and five have identity/winner holds. None was safe to promote from this audit. The report retains each source page identity and classification in `artifacts/rating-evidence/held-page-audit.json` in the original checkout. Source absence is not proof of a cancelled match or a parser defect; a fresh complete scorecard is needed to decide.

USTA's published explanation places a 3.5 dynamic rating in 3.01–3.50 and describes score, partner/opponent and championship-year effects: https://www.usta.com/en/home/play/adult-tennis/programs/national/usta-ntrp-ratings-faqs.html. The experimental band-center model uses this scale, without claiming to reproduce USTA's unpublished algorithm.

## Commands

```powershell
node --import tsx --env-file=.env.local scripts/backtest-year-end-ratings.ts --season=2025 --starts-on=2025-01-01 --cutoff=2025-10-01
node --import tsx --env-file=.env.local scripts/audit-held-tennisrecord-pages.ts
node --env-file=.env.local scripts/repair-player-refresh.mjs '--player=Nathan Meinert'
node --env-file=.env.local scripts/repair-history-discovery.mjs '--player=Nathan Meinert' --year=2026
```

The repair script is dry-run by default; `--apply` performs the bounded reversible queue scheduling. It does not reopen review/blocked/error/running rows. Audit and comparison scripts only read production data and write local evidence. Supply `--official-labels=path.json` to the comparison command for independently verified primary USTA evidence.

Official manifest records use this shape (replace example identity and source with verified records):

```json
[{"playerId":"canonical-player-uuid","season":2024,"level":4.0,"designation":"computer","sourceUrl":"https://tennislink.usta.com/verified-record","capturedAt":"2024-12-02T00:00:00Z","verified":true}]
```

## Release order and rollback

1. Apply `20261002000100_rating_forecast_evidence.sql` before deploying collector code. It creates restricted evidence storage and a label-review view without changing ratings.
2. Deploy the collector changes after checks pass.
3. Apply `20261002000200_refresh_player_profiles.sql` after deployment. It enrolls known Missouri profiles and resets the bounded seed cursor so the new code discovers fall history. Snapshot collector settings and affected queue fields first if applying outside a transactional migration workflow.
4. Observe naturally scheduled checkpoints, verify source capture dates and Nathan's 2027 discovery, and confirm new matches pass identity/result reconciliation and reach the next rating batch.

Rolling back code can leave the additive evidence table in place. Restore backed-up refresh scheduling fields only after checking that the rows have not progressed since the backup. Never blindly reset active jobs, reviews, source evidence or derived ratings. Publishing an experimental year-end forecast or rebuilding production ratings is a separate action after independent validation.

## Verification limitations

The final full suite ran: 2,932 passed and four failed. All four failures are in unchanged files: one time-dependent account-tier test and three source-text tests affected by Windows CRLF checkout. After the upcoming-scorecard change, 62 focused importer assertions passed across three files. Forecast and estimate-date tests also passed. Final lint and type checks are recorded in the PR.

Local production builds were attempted: Turbopack rejected an external dependency junction; installing dependencies inside the isolated checkout exhausted disk space; a Webpack build then exhausted the remaining space. Incomplete dependencies and generated build output were removed, leaving source intact. Local production compilation remains unverified. Linux CI with the repository's Node 22 runtime is required before release.

Direct browser access to TennisRecord fails certificate verification in this environment. Cloud collector captures provided fresh October 2 source evidence; no browser interstitial or TLS verification was bypassed.
