# Match-data integrity watch

## Running the audit

From the linked repository, run:

```powershell
npx supabase db query --linked --file scripts/audit-match-data-integrity.sql
```

This is a repeatable-read, read-only database transaction with a 90-second statement timeout. It makes no production changes. It scans the full active match cohort, not merely the first API page. Example arrays are limited to 25; counts are not limited. If a finding count exceeds its example limit, retrieve the remaining IDs before declaring it fully reviewed. Do not treat a query error, timeout, lost access, or missing output as a clean audit.

The hourly Codex thread heartbeat is named **TenAceIQ match integrity watch**. It runs in this local task environment, not as an independent production ingestion gate. Its availability depends on the scheduled task environment and production access remaining available. It alerts on new actionable findings, worsening conditions, or failed checks; unchanged findings remain quiet.

## Interpretation

- Source-winner disagreements and synthetic source authority are errors requiring source-evidence investigation. Preserve independent captain/admin corrections.
- Invalid active court rosters include missing/duplicate players, duplicate seats, wrong side sizes, and invalid seat numbers. Unlinked historical rows with ratings disabled are counted separately, not mislabeled as active player-match corruption.
- Duplicate candidates use date, discipline, player IDs, and opposing teams, independent of A/B orientation or doubles seat order. They are **review candidates only**. Same-day doubleheaders and replays are possible; never auto-merge them. Compare original event identifiers, date/time, court, teams, score and source provenance first.
- Name differences and source-key/name collisions require identity review. Aliases, punctuation, accents, and corrected display names can be legitimate. Do not auto-merge people by name.
- Pending rating updates are normal during collection. Investigate a queue older than two hours, missing refreshes, or repeated failures. Do not recalculate concurrently with another rating job.
- Import runs exceeding six minutes are stale relative to the five-minute production function limit. Check runtime errors and subsequent successful recovery before changing state.

## Source evidence and future hardening

Retain raw source pages, parser revision, participant links, explicit winner indicators, import provenance, and the exact before-values of any approved repair. Winner-first score strings do not identify court side A/B. A tiebreak marker such as 1–0 is not, by itself, proof that the left-side player won.

The audit checks stored records against retained source evidence; agreement cannot prove that a source itself is correct or catch every parser error shared by both stored and staged data. Review original pages for new layouts, missing/conflicting winner markers, match-tiebreaks, retirements, defaults, and contradictory independent uploads. Regression fixtures must cover those cases before publishing a parser change.

Parser revision 10 removes score-count winner inference. Missing or conflicting winner indicators remain quarantined with the original scorecard retained. Existing-match reads now paginate a known player's entire same-day history and fail closed on query failures or capped roster responses. A stable source match ID or an established canonical association is required to link an existing result automatically; otherwise same-day opposing-side matches require review. This prevents silent side reversal and accidental doubleheader merging. These are prevention changes, not authorization to merge the historical review inventory.

## Baseline and handoff

Baseline reports are saved in `artifacts/match-integrity-watch/`. Compare issue identity as well as counts. A replaced example with an unchanged count can still be a new issue. Repeated known findings should not be repeatedly announced, but must remain in the review inventory until resolved.

September 5 initial review: 33 possible duplicate groups and 29 name-difference mappings. One same-day pair has different winners, different court numbers and different scores; that is not enough evidence to merge it. The 370 unlinked historical non-rating rows must remain distinguished from malformed active player courts. The first checkpoint after maintenance timed out; the following checkpoint completed 24 pages. No new repair was applied as part of this watch setup.

The September 5 winner/identity repair and backups are documented separately in `artifacts/result-integrity-20260905/RELEASE-REPORT.md`. Never replay that repair's commit SQL blindly against later imports.
