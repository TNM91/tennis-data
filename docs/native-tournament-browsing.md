# Native tournament browsing

My Lab → Your competitions → Browse tournaments opens published TiQ tournament events and standalone draws. Events retain their division structure. A division provides an overview, vertical draw cards, published court assignments, recorded results, and round-robin or pool standings. Single elimination, round robin, and group playoffs share the website draw builders in `lib/tournament-draw.ts`. Other formats show their published event metadata and an explicit draw-unavailable message; they never fall back to an invented bracket in the app.

## Access and accuracy

`GET /api/mobile/tournaments` uses the verified caller JWT and existing column grants/RLS. Both root events and selected divisions must be public and non-draft, including for organizer accounts. A child must belong to the exact selected event. Root visibility/version and the full selected draw are rechecked after dependent reads. No service role, migration, permission change, entry/contact read, registration write, notification, or personal rating/stat mutation is added.

Lists and division lists use a 20-row display plus one sentinel. One chosen draw is loaded, limited to 64 entrants, 500 stored result/schedule entries, 250,000 serialized characters per map, and 500 generated matches. Oversized or unsupported draws withhold the whole draw and standings. Known current entrants and saved side bindings are checked before a winner can advance. Shared round-robin game totals now exclude deciding match-tiebreak points and parenthetical set-tiebreak points, matching existing pool standings semantics.

Court assignments come from the published schedule. Organizer-only `tiq_event_court_statuses` is deliberately not read; an absent private status is never presented as a live queued/called state. Tournament entry submission and organizer actions are separate future work.

The native response is bound to account, search, event, and division. The phone revalidates its session before and after transport, clears stale content while refreshing, ignores late replies, and closes nested dialogs when their parent closes or the app backgrounds. Draws use vertical cards; tabs and long names wrap at narrow widths and larger text sizes.

## Verification and release

Focused tests cover public/draft/private boundaries, division ownership, visibility changes, unsupported/oversized draws, stale winners, group qualification, match/game totals, request validation, transport/account binding, escaping, and privacy projections. The phone fixture exercises discovery through standings, offline recovery, larger text, device back, parent disposal, and account changes on Chromium and WebKit at 320/390 px. Production API checks use a dedicated test login and read existing public events without modifying member data.

The existing browser CI job reached 9m31s against a 10-minute timeout in the previous release. The tournament scenarios add about 32 seconds locally across both engines. Its timeout increases to 12 minutes to retain headroom without adding a separate dependency/browser installation or changing routine execution. Full verification and required CI still gate any internal beta release. Public App Store submission remains separate.
