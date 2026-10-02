# League analytics — October 1, 2026

Implemented shared mobile-first weekly highlights, player spotlights, and partnership drilldowns in the public TIQ league results and coordinator workspace. Analytics derive from authorized accepted scorecards; no new public access, notifications, or database writes were introduced. Building a recap remains an explicit coordinator action and creates an editable draft.

## Verification

- Full lint and typecheck passed.
- Full regression suite: 614 files, 3,103 tests passed.
- Final focused checks after recap integration: 14 tests passed.
- Production build passed, including final TypeScript compilation.
- Extension syntax check and diff whitespace check passed.
- Public STL Men's Finest demo verified against a production-bundle preview at 375px and 1280px: 24 accepted sets, 243 games, 15 close sets, 3 tiebreak finishes, 32 scored players, 48 distinct partnerships.
- Verified player-to-partnership drilldown, player-name partnership search (Alex gives 3 pairs), and minimum-three-set filter (empty for this one-week demo). No horizontal overflow. No browser console errors during those interactions.
- Coordinator sign-in gate verified. Authenticated coordinator analytics and recap save/send were not browser-tested because no signed-in local owner session was available. No demo or production records were changed for these UI checks.

## Data rules

- A court set counts once in league totals, once per participating player, and once per partnership.
- Analytics omit impossible set scores, non-doubles sides, duplicate player identities, and unaccepted/unpublished results.
- Pair identities are order- and case-insensitive. Sample sizes and opposing pairs remain visible; small samples are not presented as partnership ratings.
- Rank movement compares cumulative scored-player standings before/after the selected scored week. Players without prior scores have no fabricated movement.
- Improvement highlights require at least three sets in both the latest week and prior history and disclose the opponent-context limitation.
- Full legacy standings and scorecards remain available in an expandable section.

## Release review

- Release branch is based on current production (`e666ebe4`), with only analytics implementation, integration, tests, and this evidence record in scope.
- Three-week demo verified through the public results API: 72 accepted sets, 728 games, 32 partnerships with at least three sets together. The October 1 real week and existing October 8 demo week were preserved.
- Latest-week analytics verified against those records: Alex climbs 8 cumulative rank places, Gabe's highlight reports a 13-place climb, and the improvement highlight has the required multi-week samples.
- No database migration, permission changes, ownership changes, or email delivery is part of this release.
- Production deployment and post-deploy smoke checks are handled by the normal PR/Git integration workflow.
