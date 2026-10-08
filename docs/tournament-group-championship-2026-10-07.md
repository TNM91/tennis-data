# Group standings and championship progression

Adds the TIQ Group play + championship format. Fields of six or more are distributed from the confirmed entrant order into balanced groups of three or four. Each entrant has two or three group opponents. Each group winner advances to the elimination championship; smaller fields use an elimination bracket.

Qualification waits for every group result. Ties use wins, head-to-head for a two-way tie, game difference, then games won. A remaining tie or missing required game scores produces a played group tie-break. Alphabetical display order never decides qualification. Set-tiebreak and deciding match-tiebreak points are excluded from ordinary game totals.

Group results retain both participants. Corrections and clears invalidate downstream results when the participants change. Cloud saves fetch current scores, patch only results/status with an updated_at guard, and restore the prior local record on denial, stale-version rejection, or thrown write failure. Removed downstream individual results are also removed from match synchronization. Completed divisions reopen when a clear leaves unfinished play.

The field and format are locked after group scores exist, in the editor and database. Results must be cleared before restructuring. Existing draw choices remain available; no table grants or visibility policies changed.

The event page and organizer desk show division selection, progress, group tables, qualified winners, championship rounds, and a champion only after the final result. Player passes follow qualification, pending opponents, completed runs, and champions.

Focused tests passed draw sizes 6–40, unique opponents/IDs, qualification locks, head-to-head, full ties, downstream correction/clear, score parsing, field locks, current-cloud merges, concurrency and error recovery, and completed-division reopening. Desktop/390px browser checks with explicitly labeled sample teams passed scenarios for group play, qualification, champion/clear, ties, small field, empty draft, organizer callbacks, and player pass outcomes. No browser errors or horizontal overflow were observed.

Migration 20261007000600 was applied and recorded. The rollback-only linked database operation verified organizer score persistence, stale-write rejection, scored-field/format locks, clear-then-edit, and unrelated-user rejection. All fixtures rolled back. Authenticated production browser edits were not exercised. The local sample preview uses the real components and local draw/result functions; event/draw links and organizer callbacks are illustrative rather than full application navigation.

Full local release verification passed: lint, type checking, 678 test files / 3,571 tests, extension syntax, and production build. Production release remains pending. Pumpkin Playoffs remains private with no entrants or results. Its empty draft format will be set to the planned group-to-championship option after deployment; the operation refuses changed, public, populated, scored, or entered records.


The final local production bundle smoke passed the logged-out organizer access gate and private-event rejection without console errors.
