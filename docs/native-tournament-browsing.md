# Native tournament browsing

My Lab → Your competitions → Browse tournaments opens published TiQ tournament events and standalone draws. Events retain their division structure. A division provides an overview, vertical draw cards, published court assignments, recorded results, and round-robin or pool standings. Single elimination, round robin, and group playoffs share the website draw builders in `lib/tournament-draw.ts`. Other formats show their published event metadata and an explicit draw-unavailable message; they never fall back to an invented bracket in the app.

## Access and accuracy

`GET /api/mobile/tournaments` uses the verified caller JWT and existing column grants/RLS. Both root events and selected divisions must be public and non-draft, including for organizer accounts. A child must belong to the exact selected event. Root visibility/version and the full selected draw are rechecked after dependent reads. No service role, migration, permission change, entry/contact read, registration write, notification, or personal rating/stat mutation is added.

Lists and division lists use a 20-row display plus one sentinel. One chosen draw is loaded, limited to 64 entrants, 500 stored result/schedule entries, 250,000 serialized characters per map, and 500 generated matches. Oversized or unsupported draws withhold the whole draw and standings. Known current entrants and saved side bindings are checked before a winner can advance. Group play requires both saved opponent names, matching the website’s strict pool/qualification rules; unbound legacy round-robin and knockout results retain the website’s current-side compatibility. Shared round-robin game totals now exclude deciding match-tiebreak points and parenthetical set-tiebreak points, matching existing pool standings semantics.

Court assignments come from the published schedule. Organizer-only `tiq_event_court_statuses` is deliberately not read; an absent private status is never presented as a live queued/called state. Tournament entry submission and organizer actions are separate future work.

The native response is bound to account, search, event, and division. The phone revalidates its session before and after transport, clears stale content while refreshing, ignores late replies, and closes nested dialogs when their parent closes or the app backgrounds. Draws use vertical cards; tabs and long names wrap at narrow widths and larger text sizes.

## Verification and release

Focused tests cover public/draft/private boundaries, division ownership, visibility changes, unsupported/oversized draws, stale winners, group qualification, match/game totals, request validation, transport/account binding, escaping, and privacy projections. The phone fixture exercises discovery through standings, offline recovery, larger text, device back, parent disposal, and account changes on Chromium and WebKit at 320/390 px. Production API checks use a dedicated test login and read existing public events without modifying member data.

The existing browser CI job reached 9m31s against a 10-minute timeout in the previous release. The tournament scenarios add about 32 seconds locally across both engines. Its timeout increases to 12 minutes to retain headroom without adding a separate dependency/browser installation or changing routine execution. Full verification and required CI still gate any internal beta release. Public App Store submission remains separate.


## Published match finder

Draw, Schedule and Results can filter the selected public division by player or team name, including either partner in a doubles name. Schedule also supports the published day and court. Apply filters and Clear filters work entirely on the bounded draw already loaded; no request, polling, registration, notification or result write is added. Counts describe the current view in the selected division, not the whole event or personal statistics.

Applied names carry between match views. Day/court choices apply only to Schedule and survive an explicit refresh. A removed schedule choice stays visible as no longer scheduled and yields no matches until changed or cleared; refresh never silently broadens that filter. Opening a different division clears all filters. Withheld or unsupported draws still show their existing notice without partial counts or filter controls. Forms wrap at narrow widths and larger text, and an applied result count receives focus.

This independent candidate uses the existing published tournament service and contains no migration or account-linked entry integration. The separate build177 entry migration remains pending explicit production approval. TestFlight availability requires the normal release gates. Focused unit and synthetic Chromium/WebKit tests cover combined filters, doubles, empty states, escaping, no extra network reads, refresh/tab scope and phone overflow. Release verification is recorded separately.

The browser CI job allows 15 minutes for the expanded existing phone matrix; an earlier 12-minute run reached its cap during tournament checks. Coverage and retries are unchanged; no additional browser install or deployment is added.


## Entrant match evidence — local follow-up

Standings → View matches opens the exact selected player, doubles pairing or team in the current division. The existing recorded standing supplies the W/L record, win rate and ordinary-game difference. Group records are labeled separately from the all-division match list, which can include later playoff rounds. Awaiting and recorded matches retain the published opponent, score and court/time information. A missing assignment stays missing; this view does not assert live court state or calculate a personal rating.

Selection uses the full published entrant name and the standing's group, rather than a fuzzy search or a remembered list index. Matches bind to an exact whole side name. Refresh cannot silently replace the selection with a similarly named entrant or another group. A removed/withheld entry shows an unavailable state without stale statistics. Opening/returning uses the bounded snapshot already loaded and adds no request. Refresh retains the existing explicit read and clears old content until successful. Back/device Back restores the standing's action focus and scroll position; match-finder filters remain intact. Parent disposal, account changes and backgrounding retain the owning session guards.

The local follow-up is based on verified build178 commit ce3a2c0d, on a separate branch. It does not change that pinned release candidate or include the pending tournament-entry migration. Focused unit and synthetic Chromium/WebKit checks cover exact names/doubles, group scope, stale selections, offline refresh, Back focus, preserved filters and narrow/enlarged text. Real iPhone acceptance and full release gates remain necessary before shipping. Publication remains blocked by the previously recorded automatic approval-review failure; no public push, deployment or TestFlight upload is part of this local work.
