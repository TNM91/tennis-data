> Current Coach coverage: [complete native integration](native-coach-complete-integration.md). Shared invitations and first-visit setup: [native links and onboarding](native-links-onboarding.md). Historical limitations below may predate these implementations.

# Native Coach workspace

Open **More → Coach & training → Students & assignments**. Coaches use the same saved roster, assignments and player check-ins as the website. The existing Coach access check and caller's Supabase JWT apply; this change creates no entitlement, credential or database permission.

The workspace supports:

- Your 100 most recently updated students, with linked-account versus roster-only status.
- Manual student records: name, tennis level and private coaching notes. These records do not create an account or send an invitation.
- Each selected student's latest 100 assignments, prioritized with the website's review helper.
- New written practice assignments, either saved as coach-only drafts or assigned to the student. Connected students can load assigned work in their native training inbox. Unlinked roster records require an accepted coach connection before work appears in a player's account.
- Reading recorded instructions, requested proof, check-ins and existing feedback; saving coach feedback and the next focus on a completed check-in.
- Editing student names, levels, private notes and status, including pausing or resuming a student without replacing their account link or contact details.
- Editing assignment titles, focus, dates, instructions and requested proof while preserving check-ins, feedback, practice packs and other saved assignment metadata. Drafts can be published after review. Completed or archived work retains its status; the app does not reopen it.

Open a student and choose **Student invitations** to create, share, copy or revoke a connection invitation. New links are restricted to the student's account email and expire after seven days. A coach creates and reviews the link in the app, then chooses where to share it using the system share sheet. Nothing is emailed automatically. Players open **More → Coach & training → Accept coach invitation**, paste the shared link, review the named student and confirm the connection. Assigned work then appears in **Your coach & weekly plans**. The existing website invitation page remains available. Tapping a link still opens the website; automatic native link handoff is not part of this release.

Calendars, session planning, practice packs and other advanced Coach workflows still open the website through the existing private native browser wrapper. No new Coach purchase tier or live sale is enabled.

## Saves and privacy

`/api/mobile/coach` uses the existing Coach authorization helper and caller-scoped RLS client, with explicit `coach_user_id` filters. Responses omit linked player account IDs and contact details and use private/no-store caching. Only documented request fields are accepted. Request and response sizes, text, dates, identifiers and record counts are bounded.

New records use a client-generated UUID with insert-only writes. Confirmations show the intended save before sending it. A lost confirmation disables another write until **Check saved work** performs a read. Retrying keeps the same UUID. The UI does not silently retry mutations or treat a button tap as a confirmed save.

Coach feedback checks the original `updated_at` string, including its fractional precision, and updates only the owned assignment with that exact revision. The next revision advances even when two requests arrive in the same millisecond. A newer player update returns a conflict. Existing check-in JSON, completion status and unknown assignment fields survive the coach review.

Student and assignment edits use the same exact-revision rule. Student writes change only the exposed roster fields. Assignment writes merge instructions and proof into the existing JSON. If recovery finds a different revision, the frozen edit cannot be retried; the coach must discard it and review the current record.

Forms stay in memory while open, including when switching apps or opening the system share sheet. Token refresh preserves the current owner's form. Private drafts are not written to browser storage and will not survive an app restart. Account changes, logout and disposal clear Coach state and child invitation dialogs; late replies cannot populate a new account's screen. Closing an edited form requires a discard choice, and closing the workspace restores focus to its initiating button.

`/api/mobile/coach/invites` uses the existing Coach authorization and RLS client with explicit coach and student filters. Creation requires an unchanged, unlinked, unpaused owned student. Revocation checks the invitation's exact revision and pending status. Lost confirmations require a read before retrying the same operation ID. Sharing checks the latest invitation again and never copies a changed, expired, revoked or unavailable link.

The existing invitation acceptance endpoint reserves a pending invitation with a conditional update before connecting the student. It checks the invited email and coach ownership, refuses already connected or paused students, and cannot replace a concurrent player connection or coach edit. If connection fails after reservation, only the reserved account can resume; the invitation page continues to offer acceptance until the connection is confirmed. This uses existing tables and permissions, without a production migration.

`POST /api/mobile/coach/connection` requires a remotely verified signed-in account and confirmed email, but no Coach entitlement for the invited player. Preview and acceptance send the token only in a bounded JSON body. Native previews require a named student and matching nonblank invitation email; they omit email addresses, tokens and internal record IDs. A revision digest binds confirmation to the reviewed invitation and student. After a lost acceptance response, the app requires an explicit read before offering another confirmation. Existing service credentials perform the same guarded acceptance used by the website; there are no new database permissions or credentials.

## Verification

Contract, route and transport tests cover ownership, existing Coach access, malformed/oversized input, manual versus connected students, insert-only creation, exact revision checks, concurrent player updates, proof preservation and recovery without duplicate writes. Browser tests bundle the actual native entry point with synthetic local data, exercising roster creation, assignments, feedback, interrupted saves, access rejection, account changes, larger text and 320/390px layouts in Chromium and WebKit. CI runs the Coach browser checks in both mobile engines.

These local checks do not create production students, send invitations or claim physical iPhone testing.
