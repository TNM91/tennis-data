# Team season calendar

The connected-team card now offers **Season calendar**. Team details have a
**Schedule** navigation link and a compact **Add season to calendar** panel.

- Dated team fixtures are grouped by year, league, and flight. Court results,
  cancelled/postponed fixtures, other teams, and invalid dates are excluded.
- Saving uses the existing account calendar API and upload-compatible IDs so
  retries do not create a second copy of the same imported match.
- Phone sync links to My Calendar's existing subscription controls. Adding dates
  does not confirm availability. A one-time ICS download is also available.
- Missing times remain all-day. A potentially truncated 250-match query redirects
  users to their imported schedule instead of offering an incomplete season.

## Verification (September 6, 2026)

- Standard production build and TypeScript passed.
- Full lint and final changed-file lint passed.
- Full suite: 2,542 tests passed; two old navigation-label assertions failed.
  After updating those assertions for Schedule, all 18 focused tests passed.
- Synthetic browser checks verified calendar save, season selection, a two-event
  ICS download with timed/all-day dates, signed-out and empty states.
- Phone checks at 320/390px and desktop at 1280px showed no horizontal overflow.
- Production-bundle browser check verified the Schedule deep link survives URL
  normalization, scrolls to the panel, and has a unique target anchor.

Reproduce the browser check by running `scripts/verify-team-season-calendar.mjs`
on port 3041 and the built Next application on port 3042, then running
`scripts/verify-team-season-calendar-browser.mjs --production-bundle`.
All fixture writes are local; no production account or calendar was changed.

This change is isolated on `codex/team-season-calendar`, based on production
commit `fa2cddc6`. It does not include the unpublished importer migrations.
