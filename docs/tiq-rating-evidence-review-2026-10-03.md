# TIQ rating evidence review — October 3, 2026

## What recovered

At 2:11 p.m. Central, source collection was enabled and the TennisRecord timeout cooldown had cleared. Recent weekly batches completed 18 pages with no source failures. Scheduled rating batches also completed. This is fresh collection activity, unlike the retained-page processing observed during the earlier cooldown.

The 217 histories repaired earlier remain enrolled and pending. At 2:17 p.m., 113 older history entries were still ahead of their due time in the Missouri queue. They are waiting behind older work rather than losing their enrollment. More newly discovered players add more histories, so the backlog can grow while collection succeeds. Weekly scheduling is not a guarantee that every source page is current.

The audit counted 1,580 known Missouri profiles, with 1,578 refreshed within seven days and two pending their first capture. It found four missing or unenrolled history entries for John McCulley and Andy Banh. The guarded enrollment process inserted their two missing 2027 histories and enrolled their existing 2026 histories. A follow-up confirmed all four have the current refresh season and valid due dates. Running claims and review holds were preserved. Counts describe a changing, discovered population, not complete Missouri coverage.

## Why two large rating disagreements persist

The following counts use stored 2026 courts and current overall TIQ snapshots. They are not newly fetched TennisRecord histories or independently verified USTA year-end outcomes.

| Player | Current TIQ | Imported courts | Rated courts | Record in rated courts | Record in excluded courts |
| --- | ---: | ---: | ---: | --- | --- |
| Phyllis Norman | 5.116 | 17 | 13 | 11–2 | 1–3 |
| Anne Hope | 5.035 | 39 | 27 | 22–5 | 10–2 |

All 16 omitted courts are explained by the live identity-exclusion rule. Their scores parse, their lineups contain four participants, and their source eligibility is enabled. They are imported results excluded from the calculation, rather than absent imports.

Phyllis's July 22 result is present. It is excluded because the opponent Jennifer Hill has three TennisRecord profile links attached to one canonical player. One profile has `s=2` and reports 4.5 C, another reports 3.5 C and North Carolina, and a third has `s=5` without a level. That is conflicting identity evidence, not sufficient proof that the profiles represent the same person. Other excluded Phyllis courts involve Sarah Ross or Linda Johnson collisions.

Phyllis's rated sample has an 84.6% winning record, compared with 70.6% across all imported courts. Omitting three losses can make the surviving evidence look stronger. This does not quantify the rating change those courts would cause: TIQ uses games, partners, opponents, and chronological states, not win percentage alone. Correct identity assignment must come before a counterfactual replay.

Anne's rated and complete win percentages are similar (81.5% and 82.1%). Her exclusions cannot be explained as the same loss-heavy selection pattern. Missing courts still reduce coverage, but this example does not establish that exclusions inflated her rating. Remaining differences require a chronological court and opponent-strength review after identities are resolved.

## What this means for the methodology

1. Keep identity exclusions. Including a namesake's matches or starting label can contaminate several players' ratings.
2. Resolve source-specific identities using retained court links, team membership, geography, and independently verified USTA evidence where available. Names or displayed levels alone do not establish identity. Preserve source identity parameters such as `s`.
3. Repair only court-participant assignments supported by that evidence, with a before-state backup. A separate source profile may need a separate canonical person; the name constraint and existing historical assignments must be reviewed together.
4. Replay the full chronological network after reviewed assignments change. Recheck the affected players, partners, and opponents, not just the two examples.
5. Report evidence coverage separately from forecast accuracy. Counts of rated results do not establish a calibrated confidence percentage, and TennisRecord agreement does not establish USTA movement accuracy.

No ratings were manually forced toward TennisRecord. No conflicting identities were merged or removed from the exclusion rule. Current TIQ values remain estimates from the usable subset of imported evidence.

## Review receipts

- `artifacts/rating-evidence/current-rating-court-trace.json`: imported courts, scores, lineups, and current rating snapshots.
- `artifacts/rating-evidence/rating-court-gap-classification.json`: identity links responsible for each exclusion and records in the included/excluded subsets.
- `artifacts/rating-evidence/missouri-repair-followup.json`: four repaired history entries and older queued work.
- `artifacts/rating-evidence/current-source-refresh-status.json`: source recovery and recent scheduled activity.

These are read-only analysis receipts except for the separately backed-up, guarded Missouri queue enrollment repair.

## Completed source ownership repair

PR #1473 deployed model tiq-network-1.2. No canonical identities were merged or participant assignments changed. Instead, complete winning source receipts now prove individual court ownership before overriding a shared-name exclusion. The controlled replay admitted 7,218 additional usable courts. Phyllis recovered three courts (16 usable), Anne ten (37 usable); unsupported profiles and ambiguous score evidence remain excluded.

The protected production rebuild completed October 3 at 20:11 UTC, with 61,401 usable courts and 45,396 network players. Published ratings: Nathan 4.592 overall / 4.666 singles / 4.525 doubles; Phyllis 4.980; Anne 5.063. The public methodology responds successfully with the new ownership explanation. Evidence: source-owned-rating-replay.json, source-owned-live-verification.json, source-owned-backup-verification.json and source-owned-rollout-result receipts. These supersede the earlier no-write review status for this repair.
