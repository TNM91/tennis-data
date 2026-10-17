# Missouri refresh progress — October 5, 2026

The importer is making measurable progress and is refreshing match histories. It is not yet universally current.

Between 12:01:53 and 12:39:24 UTC (37.5 minutes), pending Missouri refresh pages decreased from 2,591 to 2,507. Of the previously pending pages, 124 completed: 61 histories, 35 player profiles and 28 match pages. Across existing pages, 126 received a new refresh timestamp, including two team pages. Another 38 pages were discovered during the interval, explaining why the net reduction was smaller than completed work.

The oldest due pending timestamp advanced from October 4 at 17:12 UTC to 20:55 UTC. Latest inspected completed import jobs processed 18 pages each with zero source failures. These observations support leaving the collector's current guarded operation intact rather than treating the queue as stalled or increasing source load without throughput testing.

Remaining work: drain the 2,507 pending pages, continue new discovery and scheduled refreshes, and review unresolved scorecards separately. These snapshot counts are not a promised completion time. A completed importer run or recent rating recalculation alone does not establish freshness for every player.

No production settings or queue rows were changed. Evidence: artifacts/rating-evidence/missouri-refresh-progress-2026-10-05.json and its before/after queue snapshots. The reproducible comparison is compare-missouri-refresh-progress.mjs.
