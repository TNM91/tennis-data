# Native Coach workspace

Open **More → Coach & training → Students & assignments**. Coaches use the same saved roster, assignments and player check-ins as the website. The existing Coach access check and caller's Supabase JWT apply; this change creates no entitlement, credential or database permission.

The workspace supports:

- Your 100 most recently updated students, with linked-account versus roster-only status.
- Manual student records: name, tennis level and private coaching notes. These records do not create an account or send an invitation.
- Each selected student's latest 100 assignments, prioritized with the website's review helper.
- New written practice assignments, either saved as coach-only drafts or assigned to the student. Connected students can load assigned work in their native training inbox. Unlinked roster records require an accepted coach connection before work appears in a player's account.
- Reading recorded instructions, requested proof, check-ins and existing feedback; saving coach feedback and the next focus on a completed check-in.

Connection invitations, calendars, session planning, editing existing student/assignment setup and other advanced Coach workflows still open the website through the existing private native browser wrapper. No new Coach purchase tier or live sale is enabled.

## Saves and privacy

`/api/mobile/coach` uses the existing Coach authorization helper and caller-scoped RLS client, with explicit `coach_user_id` filters. Responses omit linked player account IDs and contact details and use private/no-store caching. Only documented request fields are accepted. Request and response sizes, text, dates, identifiers and record counts are bounded.

New records use a client-generated UUID with insert-only writes. Confirmations show the intended save before sending it. A lost confirmation disables another write until **Check saved work** performs a read. Retrying keeps the same UUID. The UI does not silently retry mutations or treat a button tap as a confirmed save.

Coach feedback checks the original `updated_at` string, including its fractional precision, and updates only the owned assignment with that exact revision. The next revision advances even when two requests arrive in the same millisecond. A newer player update returns a conflict. Existing check-in JSON, completion status and unknown assignment fields survive the coach review.

Forms stay in memory while open. Token refresh preserves the current owner's form. Account changes, disposal and backgrounding clear private Coach state; late replies cannot populate a new account's screen. Closing an edited form requires a discard choice, and closing the workspace restores focus to its initiating button.

## Verification

Contract, route and transport tests cover ownership, existing Coach access, malformed/oversized input, manual versus connected students, insert-only creation, exact revision checks, concurrent player updates, proof preservation and recovery without duplicate writes. Browser tests bundle the actual native entry point with synthetic local data, exercising roster creation, assignments, feedback, interrupted saves, access rejection, account changes, larger text and 320/390px layouts in Chromium and WebKit. CI runs the Coach browser checks in both mobile engines.

These local checks do not create production students, send invitations or claim physical iPhone testing.
