# Teams availability summary

Connected captains with Captain access see a compact “Who can play?” read inside each team card when an upcoming match is known. No separate dashboard or new navigation item.

- Available, No reply, and Not sure stay visible; Can’t play and captain-confirmed totals appear underneath.
- “View replies” expands names and distinguishes Player replied, Season reply, Confirmed by captain, and Saved availability when provenance is otherwise unknown.
- A single matching saved lineup supplies the selected-player waiting list. Multiple saved versions prompt selection in Builder; browser-only unsaved drafts are not presented as saved assignments.
- “Remind players” offers the existing group-message preparation flow or a scoped link to individual texts in Builder. Nothing is sent automatically.
- The group message starts with the next match, optionally requests the whole season, and includes calendar instructions. Preparation uses the existing authorized action and preserves stopped invitations and saved answers.
- Refresh shows checking, changed, or no-change feedback. Visible pages refresh once per minute. A failed check clears counts and provides Retry/Open schedule rather than misleading zeros.

## Data safeguards

The read-only endpoint requires Captain entitlement and an accepted captain/co-captain connection for the exact team, league, and flight before reading private data. Responses are private/no-store. No invitation secrets, private notes, or phone numbers are returned.

Replies match player IDs, or an exact server-owned roster key for unlinked season respondents, never names. Latest timestamps win; a newer player No overrides an older captain Yes. Season answers must still match the fixture ID/date/time and an active allowed invitation. Date-only legacy availability is omitted on double-headers. Ambiguous or incomplete schedule reads and failed/bounded queries do not produce confident counts.

Availability counts are not eligibility checks or final lineup confirmation. Legacy match-day answers cannot prove that an unchanged-date start time was reconfirmed; the expanded reply view tells captains to reconfirm after a time change. Only the existing explicit captain-confirmation marker is labeled captain-confirmed; other unproven saved answers retain neutral attribution.

## Verification

- 2,725 tests across 532 files passed, including 18 focused summary/model/API tests.
- Full lint and standalone TypeScript checks passed.
- Final production build passed. Built endpoint rejected signed-out access (401).
- Signed-in production-bundle check on localhost:3030 loaded both connected teams independently. SuperSmash showed 6 available (2 captain-confirmed), 5 roster members with no reply, and no selected saved-lineup players waiting; the other team showed its own 1 available and 9 with no reply. This was read-only; no real group requests were prepared.
- Isolated browser checks at 320px, 390px, and 1280px: compact counts, reply provenance, safe message preparation, unchanged refresh feedback, failed-check recovery, and a later No changing the totals.
- Browser harness: `scripts/team-availability-summary-fixture.mjs` on localhost:3041. Synthetic data and same-origin-only API access; no production replies, invitations, links, accounts, or messages changed.

This enhancement is local and has not been published.
