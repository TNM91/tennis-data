# Native import repair and preview

The bundled app can append a missed court or roster player to a supported saved read (up to 10 courts or 100 players). Use the original file for every correction. Extracted rows cannot be removed or relabeled; only added rows can be removed. Added facts retain the original source provenance and do not gain parser confidence. Added or corrected roster ratings are self-rated, not verified or TIQ dynamic ratings. Contacts remain private.

Preview import compares unsaved corrections and additions against saved records without saving, refreshing ratings, sending notifications, or invoking OCR. Scorecards show new, updated, or unchanged-to-skip counts separately from individual courts. Roster previews show new players, existing players to refresh, and preserved members/contact-detail counts. Matched player-name substitutions appear for review; the existing bounded name matcher does not support a global new-player count for scorecards.

Each edit, addition, removal, reset, or refresh discards the receipt and acknowledgement. Confirmation recomputes a server-side evidence hash before any review writes. Changed or unavailable evidence requires another preview. This is an optimistic comparison, not a database-wide transaction lock. A lost commit response keeps actions locked until the saved upload is refreshed. Existing clients retain their previous confirmation protocol.

The preview uses the existing importer through a read-only allowlist: at most 120 queries, a 30-second total deadline and 12-second per-query timeout. The existing player-matching sample remains capped at 5,000; current roster/contact comparisons at 500 rows; scorecard courts at 10 and participants at 40. Other reads fail closed. Requests are explicit, with no automatic polling, retry, paid OCR call, new credential, schema migration, or permission change. Confirmation adds one bounded read-only comparison before the existing import.

After a refreshed saved imported outcome, Open imported records offers native team views, exact-name player profiles, and saved individual courts. Ambiguous names are not guessed. Court reads require the selected external match ID, completed status, public-history eligibility, and singles/doubles type; parent team totals cannot become individual results. Owner/session and visit guards also apply to nested views.

Some source labels repeat a number across singles/doubles. The existing importer persists court identity by number alone. The correction path now refuses collisions rather than silently overwriting a court. Such files, zero-row reads, larger drafts, contact edits and unsupported formats still need Data Assist review. This change does not rewrite legacy match IDs or repair past imports.

Duplicate fingerprints treat equivalent source calendar dates and saved ISO dates alike. Score, winner, date, participant or court changes still require an update.

Validation uses synthetic exports and owner-scoped fixtures. Chromium/WebKit browser coverage checks 320/390px layouts, added rows, read-only previews, stale evidence, duplicate skips, uncertain responses and saved-result navigation. Physical iPhone keyboard/Files/VoiceOver/Dynamic Type and sandbox purchase/restore remain separate device checks. No real member upload is submitted for QA.

Scorecard refreshes replace the saved child-court set. Preview and receipt rechecks refuse a source read that omits, renumbers or changes the type of an existing saved court. Older native correction confirmations receive the same read-only coverage check before writes. Complete missing courts from the original source or finish exception review in Data Assist. This does not change the legacy web import protocol or rewrite saved IDs. The coverage comparison adds one bounded child-court read to each comparison pass.

## Missing saved courts

When a native scorecard preview or confirmation omits a saved court, the API returns a bounded court-only report before any mutation. The app names each missing court and can prefill its number and type. Players, score and winner remain blank until the uploader supplies them from the source file. Existing corrections survive this block; no confirmation is possible until another successful preview and acknowledgement.

A conflicting saved court type opens the Data Assist recovery path rather than relabelling a source row. Read failures and malformed saved identities remain comparison errors with no partial report. Reports contain only court numbers, singles/doubles and missing/type-changed reasons; no saved player names, contacts or source text. Older native clients retain their existing safe preview-refresh response. These reports are fresh comparisons, not a transaction-wide lock, and do not change the legacy web import protocol.

Browser fixtures cover missing-court recovery, type conflicts, failed comparisons and a court appearing between preview and confirmation in Chromium and WebKit at 320 and 390 pixels. Real Files selection, the iPhone keyboard, VoiceOver and Dynamic Type still require device verification.
