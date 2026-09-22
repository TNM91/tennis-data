# Season availability hub

Entry: Teams → team → Season calendar → Season availability.

- **My availability:** A captain whose linked player ID is on the exact season roster can answer directly. Choose Yes / Not sure / No, optionally start with Available for all, then Save availability. This reuses the personal-response flow; it does not select or confirm a final lineup.
- **Team availability:** Counts every current roster player, not only invited players. Review the next four matches or expand the full season; switch to By player for completion and individual answers. Uninvited and stopped links are distinct from unanswered active invitations.
- **Invite players:** Prepare and individually share private response links. Existing links and answers are preserved. Stopped links require explicit replacement. No message is sent by preparing a link.
- Calendar options remain beside season availability. Switching seasons or closing the editor is disabled while personal answers are unsaved or saving; changing views asks before discarding unsaved edits.

Self entry resolves `profiles.linked_player_id` against the server-loaded roster, after exact team/league/flight captain authorization. It never accepts the browser's choice of identity or guesses from a name. The original public personal links remain supported.

## Verification

The local synthetic harness uses no production credentials or records. Run `node scripts/season-kickoff-browser-fixture.mjs`, then open `/captain-fixture` on port 3021. `/phone-fixture` provides a 390-pixel iframe preview.

Checked: direct personal entry; all-available with a single unavailable exception; save and reopen; updated whole-team totals; By player; preparing the remaining roster without changing existing answers; unanswered versus uninvited counts; expansion from four to all 14 dates; disabled close/calendar controls for unsaved answers; and switching to calendar options after saving. Unit/API regressions cover self-identity spoofing, absent identity, stale dates, stopped links, removed roster players, and empty seasons.

Full ESLint and the Next.js production build passed (251 generated pages). The full regression run passed 2,652 tests with one five-second brand-file scan timeout; that file passed all five tests immediately when rerun alone. No brand artwork was changed.

Native Apple/Google account actions and production availability submissions are not performed by this harness. A prepared personal link is not evidence that a text was sent or received.
