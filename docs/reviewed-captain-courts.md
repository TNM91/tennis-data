# Reviewed source links to captain courts

`tennisrecord_reviewed_captain_courts` is a private, service-only registry for
individual source events and courts reviewed against existing captain records.
It does not create global team or league aliases, infer an association from
players and dates, reopen access/identity holds, or change a captain result.

Before registration, retain and review the exact source scorecard. Verify its
event/year, date, venue, court/discipline, every player by matched source identity,
side orientation, winning players and score against the captain court and parent.
Save the retained page ID, exact source and captain identity snapshots, matched
player IDs, review notes and the existing processed rating marker. A captain
court can belong to only one reviewed source court; database uniqueness rejects
second-event reuse. Changes must be reviewed explicitly, not silently upserted.

Every reconciliation loads reviews for its source events in indexed batches of
50, paging 200 rows. This adds one bounded database read per ordinary source-page
reconciliation, not additional source HTTP requests. The importer checks the
retained page, current parent/court metadata, all source identities and current
captain participants again. Changed evidence fails closed into review rather
than falling through to create another match.

All retained source-event evidence on associated fingerprints is still checked.
Only a reviewed captain's local fingerprints may lack public-source evidence;
any retained invalid URL or different event still blocks reconciliation.

Captain observations use source-side coordinates when the source reverses teams.
Equivalent reviewed set sequences are normalized for comparison; original
captain scores and winner sides are retained in observation audit data. Genuine
disagreements stay visible. Production match rows, participants and ratings are
never rewritten through this reviewed captain path. An already processed court
carries its processed marker to the new association so it does not trigger a
redundant full rating rebuild. Subsequent refreshes preserve their existing marker.

Apply the migration before releasing importer code. Register reviewed links only
after the code is verified, then release only the exact duplicate-context staging
holds covered by those links. Reconcile those source keys with rating rebuilding
disabled and verify the same match/player IDs, scores, winners and rating values.
Run reconciliation twice to prove repeat refreshes remain idempotent.

The disposable SQL check runs with `TIQ_PGLITE_MODULE` pointing to an existing
PGlite module: `node scripts/verify-reviewed-captain-courts.mjs`. It checks private
role grants and duplicate-event protection without changing production.
