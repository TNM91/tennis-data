# Native player calendar

The app opens Calendar from More or the My Lab calendar card. It uses existing account calendar entries, approved player competition schedules and shared Coach dates. It does not open a website or request access to the device’s calendar database.

## Player flow

- Switch between Monday-first weeks and calendar months. Choose a day, all dates or a personal/competition/Coach filter.
- Add or edit a personal practice, match, lesson, reminder or availability note, then review before saving. Empty time means all day/time not set.
- Repeat personal entries daily, weekly or monthly. Monthly entries skip months without the anchor day. Editing or deleting a repeating entry affects the whole series; individual exceptions are not supported by the existing storage model.
- Review a competition’s current date, time and location before sending an availability reply. A personal availability note does not send an RSVP or alter a competition.
- Export the selected dates/type as a one-time ICS file. Choose the event time zone; the default matches the existing website calendar (America/Chicago). Timed events use 90-minute slots and Coach lessons use 60 minutes. Only shown occurrences are exported, without recurrence rules, URLs or account tokens. Later changes do not sync.

Team-room practices, dates held only in browser storage and unapproved entries are outside this calendar’s sources. The Coach roster calendar remains in Coach & training. Source failures are labeled; an unavailable personal source never appears as an empty account.

## Data and write protection

`/api/mobile/calendar` verifies the bearer account remotely and uses its existing caller-scoped Supabase client. Responses are private and not cacheable. Every personal/response query includes the verified owner; client-supplied owner fields are rejected. There are no new tables, grants, credentials, services or native permissions.

Reads cover at most 62 days, include earlier personal recurrence anchors, and reject source overflow rather than silently truncating a calendar. Approved competition mapping, Coach lesson/due-date generation, canonical venue resolution and ICS formatting reuse their existing engines.

Personal creates use a stable client-generated ID. Edits and deletes compare the saved PostgreSQL revision, including microseconds, and confirm owned state after writing. Existing venue identifiers survive edits unless the player changes location. Availability writes verify the reviewed event snapshot and previous response revision; a changed schedule requires another review. Replaying an already-confirmed identical reply does not insert another organizer alert. Alert failure is reported separately from a saved response.

An interrupted write disables a second save until an explicit read checks the saved entry. Recovery reuses the original create ID and reads the latest owned record; a differing record requires review. Account changes dispose drafts and ignore late responses. Same-account token refresh, reconnect and app resume preserve a draft. Closing an unfinished change requires a discard decision.

## Verification

Synthetic unit/API tests cover malformed dates and payloads, recurrence/DST boundaries, owner isolation, conditional writes and read-back, partial source failures, reviewed RSVP snapshots and organizer-alert replay. Browser cases run through the actual app navigation fixture, with external traffic blocked, covering larger text at 320/390 pixels, calendar modes and filters, reviewed CRUD, lost-save recovery, recurring deletion, RSVP, lifecycle isolation and ICS file contents.

Real iPhone acceptance remains necessary for touch date/time controls and completing an ICS import through the share sheet. Automated checks never create real calendar entries or send real organizer alerts.
