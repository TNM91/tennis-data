# Native Updates inbox

Updates brings the existing `internal_notifications` records into the app. The header bell shows an account-wide unread count; More → Updates opens the same inbox. All/Unread and type filters narrow the list. Dates, unread accents and short previews keep notices readable at narrow widths and larger text sizes.

## Data and access

- Reuses the website's notification projection and existing recipient RLS. This release adds no tables, grants, notification creation, push delivery, preferences or background jobs.
- Every read and read-status write checks the current account before and after transport, filters by its recipient ID and pins that account's JWT to the query. Admin users still see only their own inbox here. Late responses from a previous account are discarded.
- Pages contain 25 records, ordered by `created_at` and `id`. The cursor preserves PostgreSQL microseconds. At most 100 records are loaded; filtering or refreshing starts a new view. Duplicate or malformed results fail closed.
- Mark read changes only `read_at` for the reviewed IDs. Mark shown read first lists the loaded unread notices to confirm. A separate owned read-back must confirm each ID before the UI updates. An interrupted write requires an explicit refresh before further writes; older unseen notices stay unchanged.
- Unread count failures show an unknown state, not zero. One count runs on account entry, with another on an explicit inbox refresh or successful read action. Token refresh does not poll. Opening or refreshing the inbox uses one page query and one count; loading older records uses one query. A read action uses one bounded update, one read-back and one count. Coach conversation resolution adds one exact-ID read.

## Destinations and lifecycle

Only recognized TenAceIQ destinations have an Open action: team chat, league, tournament, individual scorecard, invitation preview, Coach, My Lab and training plans. Invitation acceptance remains a separate explicit action. External links, authentication/billing paths and unsupported targets remain safe text previews; there is no website fallback.

An existing direct Coach thread resolves only through its exact accessible conversation record and `coach_student` relation. The existing Coach messages endpoint rechecks the current connection before showing history. A missing connection never silently opens another student's messages. General support/direct website threads currently have no native destination. The inbox does not introduce new Coach message notifications.

Owned detail dialogs return to the retained inbox and its opener. Android Back delegates to the child, including its draft confirmation. Account changes dispose the inbox and its children. A root inbox closes when backgrounded; an open child keeps its existing lifecycle so an unsent Coach draft survives resume. Same-account token refresh preserves the active view. Reading a notice changes its notification status; chat read status remains the responsibility of the chat view.

## Verification

Unit checks cover own-account queries, pinned authorization, malformed records, exact cursors, read-back confirmation, stale responses, destination allowlisting and unread-counter races. The full native navigation browser suite uses synthetic accounts and blocks external requests. It covers 320/390 px widths, larger text, account switching, filters, pagination, interrupted writes and nested league/tournament/Coach destinations. Existing Coach browser checks cover the unchanged message workflow.

Before release, run full repository verification, the native bundle and required CI. Inspect the signed package against the candidate bundle. Physical TestFlight acceptance remains separate: open the bell, filter unread notices, follow an available destination, return, and verify read state after a refresh. No production notification or message is created for automated QA.
