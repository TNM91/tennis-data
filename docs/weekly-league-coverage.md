# Weekly league coverage

The existing three-minute collector reserves the first of its existing request slots
for registered leagues. It keeps the same request cap, pacing, source cooldown,
run lock, deferred retries and review holds. Empty priority work falls back to
the ordinary current-season lanes. This is not additional collection capacity.
Giving monitored work the first slot prevents earlier source timeouts from
using the checkpoint budget before a monitored page gets an opportunity.

Register a league from an exact team URL whose retained roster names its league:

```
npx tsx --env-file=.env.local scripts/register-league-watch.ts --team-url=<exact-source-team-URL>
```

Inspect the printed counts and saved plan in `.codex-audit/league-watches/`.
Repeat with `--apply` to register source-only monitoring and queue missing direct
links. This requires service credentials. It sends no TennisRecord requests and
does not match people, merge league names, alter ratings or reopen identity/access holds.
The sole exception is the exact legacy "No complete TennisRecord court results"
parser hold: a retained scorecard with two same-season teams, one same-season
league, a valid past scheduled date and no courts or printed winner returns to
the normal seven-day publication check. Identity and access holds stay held.

The collector checks the registered frontier once per seven days and stores one
private snapshot per league. Admin → TennisRecord shows the last check and next
check, missing/stale pages, missing roster listings, incomplete scorecard detail,
unposted results and valid courts awaiting canonical player statistics.
Snapshots are weekly observations, not a live completion guarantee.

A captured directory must establish the expected teams, and a league-label
mapping must be explicitly verified before coverage can be certified. A known
frontier alone cannot prove every team has been discovered. Source publication
delays and held identities remain visible; they never become invented results.
`mapping_verified` defaults to false and must remain false until a reviewer has
verified the exact source league/flight relationship. No name-only aliasing.

The initial three leagues contain 32 known teams and 224 distinct scorecards.
At the current 18-page ceiling, one reserved slot per three-minute checkpoint
provides at most 480 monitored requests/day (3360/week), drawn from the same
8640/day theoretical total. Actual throughput is lower during cooldowns,
timeouts, budget yields and rating reservations. The roughly 259-page known
frontier requires around 37 successful monitored reads/day for a seven-day
target; this is a capacity estimate, not an external-source availability promise.

The snapshot queries use exact source URL indexes; the admin heartbeat reads
only saved reports. No whole-archive coverage scan runs in the heartbeat.
The monitor sends no email or other outbound messages.
