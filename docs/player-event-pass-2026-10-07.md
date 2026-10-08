# Player event pass — Pumpkin Playoffs

The public event page includes a pass for each confirmed team or player: event date and venue, directions, organizer-confirmed check-in, and the next unfinished match. An unassigned earlier round stays ahead of a scheduled later round. A finished draw does not claim the event is complete until the organizer closes the division.

The event desk includes arrival confirmation and clear controls. Attendance is stored separately from draws, results, and private contact data. The migrations restrict writes to existing tournament managers and reads to users who can already read the associated division. Removed entrants are hidden. Inherited Supabase default privileges are explicitly revoked before granting only the approved scopes.

Local browser QA used labeled sample teams and simulated arrival storage. Desktop and 390px phone checks passed: selection, assigned and pending courts, arrival confirmation, clear, refresh, and failed-save/direct-retry behavior. Failed saves retain the previous check-in state and never report success. No browser errors or horizontal overflow were observed. The preview's draw and event links show their destinations but do not provide full application routes.

Full local release checks passed: lint, type checking, 676 test files / 3,555 tests, extension syntax, and the Next.js production build. Production-bundle route smoke passed: organizer access gate and anonymous private-event rejection, with no browser errors.

The user approved attendance storage and its specific visibility/write scopes on October 7, 2026. Both migrations were applied. The rollback-only backend operation passed manager save/clear, unknown-entrant rejection, private attendance visibility, public attendance reads, anonymous write rejection, and unrelated authenticated write rejection. All sample backend fixtures rolled back. Authenticated production browser edits were not exercised; persistence and permission behavior were verified directly against the database roles.

No production entrants, schedules, scores, or event visibility changed. Pumpkin Playoffs remains a private draft. PR/CI and production release are the remaining steps.
