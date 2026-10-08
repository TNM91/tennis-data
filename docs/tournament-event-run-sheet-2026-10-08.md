# Event-day run sheet

The organizer event desk can prepare an event-wide court-staff snapshot. Preparation reloads event divisions and check-ins before creating an in-app print view and portable HTML copy. It groups assigned matches by court, lists unscheduled matches separately, and includes a confirmed-entrant check-in roster. Playoff placeholders stay unresolved until qualifying results are recorded. Staff can open the in-app view, use Print/Save as PDF, or save the HTML copy.

Court-overlap warnings use the organizer's selected planning window. The copy shows its preparation timestamp and event time-zone label. Later schedule, field, result, or planning-window changes invalidate the prepared link. Preparation failures discard the old document. Stale requests cannot replace a newer snapshot. No polling, extra database tables, or public sharing are added.

The sheet includes only event metadata, confirmed entrants, schedule, check-in status, and valid draw results. Contact details, registration payments, and private organizer notes are excluded. Names and other text are HTML-escaped. The exported page has no executable scripts or remote assets. Screen controls retain the site's navy/lime palette; printing uses a legible paper layout with repeatable table headings and rows kept together.

Validation covers court normalization and grouping, pending playoff slots, event filtering, confirmed-only arrival counts, overlaps across divisions, safe HTML, private-data exclusion, and empty events. Browser checks cover preparation, print-view opening, desktop and 390px controls, and visible print layout. No real event entrants are seeded for testing.
