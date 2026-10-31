# Native player calendar

The app opens Calendar from More or the My Lab calendar card. It uses existing account calendar entries, approved player competition schedules and shared Coach dates. It does not open a website or request access to the device’s calendar database.

## Player flow

- Switch between Monday-first weeks and calendar months. Choose a day, all dates or a personal/competition/Coach filter.
- Add or edit a personal practice, match, lesson, reminder or availability note, then review before saving. Empty time means all day/time not set.
- Repeat personal entries daily, weekly or monthly. Monthly entries skip months without the anchor day. Editing or deleting a repeating entry affects the whole series; individual exceptions are not supported by the existing storage model.
- Review a competition’s current date, time and location before sending an availability reply. A personal availability note does not send an RSVP or alter a competition.
- Export the selected dates/type as a one-time ICS file. Choose the event time zone; the default matches the existing website calendar (America/Chicago). Team practices use their recorded end time when available; other timed events use 90-minute slots and Coach lessons use 60 minutes. Only shown occurrences are exported, without recurrence rules, URLs or account tokens. Later changes do not sync.

Invited team practices now appear alongside personal, approved competition and shared Coach dates. Dates held only in browser storage and unapproved competition entries remain outside this calendar’s sources. The Coach roster calendar remains in Coach & training. Source failures are labeled; an unavailable personal source never appears as an empty account.

## Data and write protection

`/api/mobile/calendar` verifies the bearer account remotely and uses its existing caller-scoped Supabase client. Responses are private and not cacheable. Every personal/response query includes the verified owner; client-supplied owner fields are rejected. There are no new tables, grants, credentials, services or native permissions.

Reads cover at most 62 days, include earlier personal recurrence anchors, and reject source overflow rather than silently truncating a calendar. Approved competition mapping, Coach lesson/due-date generation, canonical venue resolution and ICS formatting reuse their existing engines.

Personal creates use a stable client-generated ID. Edits and deletes compare the saved PostgreSQL revision, including microseconds, and confirm owned state after writing. Existing venue identifiers survive edits unless the player changes location. Availability writes verify the reviewed event snapshot and previous response revision; a changed schedule requires another review. Replaying an already-confirmed identical reply does not insert another organizer alert. Alert failure is reported separately from a saved response.

An interrupted write disables a second save until an explicit read checks the saved entry. Recovery reuses the original create ID and reads the latest owned record; a differing record requires review. Account changes dispose drafts and ignore late responses. Same-account token refresh, reconnect and app resume preserve a draft. Closing an unfinished change requires a discard decision.

## Verification

Synthetic unit/API tests cover malformed dates and payloads, recurrence/DST boundaries, owner isolation, conditional writes and read-back, partial source failures, reviewed RSVP snapshots and organizer-alert replay. Browser cases run through the actual app navigation fixture, with external traffic blocked, covering larger text at 320/390 pixels, calendar modes and filters, reviewed CRUD, lost-save recovery, recurring deletion, RSVP, lifecycle isolation and ICS file contents.

Real iPhone acceptance remains necessary for touch date/time controls and completing an ICS import through the share sheet. Automated checks never create real calendar entries or send real organizer alerts.

## Team practices and RSVP

Calendar includes practices with an exact account invitation and current accepted team link, open team conversation, current participation and no member removal. Names alone never establish an invitation or access. Cancelled and completed practices retain their recorded status. In, Out, Maybe, Waitlist and captain confirmation use the existing RSVP placement helper; the app does not infer attendance from a date or team result.

The Team practices filter, date markers and agenda cards lead to a practice summary. Open practice & RSVP loads that exact practice through the existing player-practice endpoint, with the full team/league/flight scope. A missing or inaccessible practice never falls back to another event. The existing review, revision checks and interrupted-reply recovery remain authoritative; opening Calendar or the practice does not send a reply. Returning refreshes Calendar while retaining its month/week, date and source filter, then restores the same agenda action when it remains available. Parent Back delegates to the nested RSVP, protecting an unfinished reply. Account changes dispose both views and discard late results.

The additional verified-account GET `/api/mobile/calendar/practices` accepts only a validated date window of at most 62 days. Its existing service client reads at most 100 owner invitations using a date-filtered foreign-key join, then checks accepted links, parent conversations, participants and removals in batches. At most 50 accepted links and 5,000 RSVP rows are inspected; a practice roster is limited to 250. The source fails closed on overflow or unavailable authorization. There are seven bounded database reads in the complete path, independent of the number of teams; an account without invitations uses one. All new reads disable automatic database retries. Calendar adds one team-source HTTP GET on entry or explicit refresh, with no polling, cron or new cache. Team-source failure preserves the other loaded sources and clearly labels team dates unavailable.

The calendar projection contains only date/time/location/title, exact scope and the account's displayed RSVP/confirmation. Other invitees' identities, contacts, notes, practice focus, public invitation tokens and revisions are not returned. Dates are not copied into personal calendar storage. Responses are private/no-store with no-referrer. No database migration, grant, credential, native permission, dependency, membership initialization or notification is added.

Calendar export uses the recorded team-practice end time, or the existing 90-minute practice fallback capped at 23:59. Cancelled team practices and timed entries without a usable same-day export range are excluded; the export review counts only exportable dates. The selected event time zone, one-time-file behavior and explicit share action remain unchanged; no RSVP link or token is included. Exporting does not reply to or update a practice.

Synthetic unit/API and both phone browser engines cover scoped invitations, current access, source limits/failures, queue placement, export duration, narrow/enlarged-text layouts, exact-event opening, reviewed RSVP, lost-reply recovery, retained filters/focus, nested Back and account disposal. Actual minified-bundle checks block all external HTTP and WebSocket traffic. Physical iPhone/VoiceOver and completing an external calendar import remain separate acceptance checks. No real practice, invitation, RSVP, message or notification is created for automated QA.
