# Native tournament browsing

My Lab → Your competitions → Browse tournaments opens published TiQ tournament events and standalone draws. Events retain their division structure. A division provides an overview, vertical draw cards, published court assignments, recorded results, and round-robin or pool standings. Single elimination, round robin, and group playoffs share the website draw builders in `lib/tournament-draw.ts`. Other formats show their published event metadata and an explicit draw-unavailable message; they never fall back to an invented bracket in the app.

## Access and accuracy

`GET /api/mobile/tournaments` uses the verified caller JWT and existing column grants/RLS. Both root events and selected divisions must be public and non-draft, including for organizer accounts. A child must belong to the exact selected event. Root visibility/version and the full selected draw are rechecked after dependent reads. No service role, migration, permission change, entry/contact read, registration write, notification, or personal rating/stat mutation is added.

Lists and division lists use a 20-row display plus one sentinel. One chosen draw is loaded, limited to 64 entrants, 500 stored result/schedule entries, 250,000 serialized characters per map, and 500 generated matches. Oversized or unsupported draws withhold the whole draw and standings. Known current entrants and saved side bindings are checked before a winner can advance. Group play requires both saved opponent names, matching the website’s strict pool/qualification rules; unbound legacy round-robin and knockout results retain the website’s current-side compatibility. Shared round-robin game totals now exclude deciding match-tiebreak points and parenthetical set-tiebreak points, matching existing pool standings semantics.

Court assignments come from the published schedule. Organizer-only `tiq_event_court_statuses` is deliberately not read; an absent private status is never presented as a live queued/called state. Account-linked entry submission and organizer review use the separate guarded flow in `native-tournament-entry.md`.

The native response is bound to account, search, event, and division. The phone revalidates its session before and after transport, clears stale content while refreshing, ignores late replies, and closes nested dialogs when their parent closes or the app backgrounds. Draws use vertical cards; tabs and long names wrap at narrow widths and larger text sizes.

## Verification and release

Focused tests cover public/draft/private boundaries, division ownership, visibility changes, unsupported/oversized draws, stale winners, group qualification, match/game totals, request validation, transport/account binding, escaping, and privacy projections. The phone fixture exercises discovery through standings, offline recovery, larger text, device back, parent disposal, and account changes on Chromium and WebKit at 320/390 px. Production API checks use a dedicated test login and read existing public events without modifying member data.


## Published match finder

Draw, Schedule and Results can filter the selected public division by player or team name, including either partner in a doubles name. Schedule also supports the published day and court. Apply filters and Clear filters work entirely on the bounded draw already loaded; no request, polling, registration, notification or result write is added. Counts describe the current view in the selected division, not the whole event or personal statistics.

Applied names carry between match views. Day/court choices apply only to Schedule and survive an explicit refresh. A removed schedule choice stays visible as no longer scheduled and yields no matches until changed or cleared; refresh never silently broadens that filter. Opening a different division clears all filters. Withheld or unsupported draws still show their existing notice without partial counts or filter controls. Forms wrap at narrow widths and larger text, and an applied result count receives focus.

Match filtering uses the existing published tournament service and adds no write or permission. The tournament-entry migration from PR #1738 has been applied and verified separately; account-linked entry is included in the combined local candidate. TestFlight availability requires the normal release gates. Focused unit and synthetic Chromium/WebKit tests cover combined filters, doubles, empty states, escaping, no extra network reads, refresh/tab scope and phone overflow. Release verification is recorded separately.

The browser CI job allows 25 minutes for the combined coverage. The 308 local tournament, league and account cases completed in 8.5 minutes with two workers and summed to 15.2 minutes of case runtime. CI uses one worker and also runs captain, chat, insights and imports, plus setup and artifact capture. The prior remote job measured 174 seconds for 66 competition cases and 95 seconds for 26 tournament cases; the combined suite has 182 and 82 respectively. The larger limit preserves headroom without another job, browser installation, retry or deployment; successful work ends as soon as its checks finish.


## Published entrant match evidence

Standings → View matches opens the exact selected player, doubles pairing or team in the current division. The existing recorded standing supplies the W/L record, win rate and ordinary-game difference. Group records are labeled separately from the all-division match list, which can include later playoff rounds. Awaiting and recorded matches retain the published opponent, score and court/time information. A missing assignment stays missing; this view does not assert live court state or calculate a personal rating.

Selection uses the full published entrant name and the standing's group, rather than a fuzzy search or a remembered list index. Matches bind to an exact whole side name. Refresh cannot silently replace the selection with a similarly named entrant or another group. A removed/withheld entry shows an unavailable state without stale statistics. Opening/returning uses the bounded snapshot already loaded and adds no request. Refresh retains the existing explicit read and clears old content until successful. Back/device Back restores the standing's action focus and scroll position; match-finder filters remain intact. Parent disposal, account changes and backgrounding retain the owning session guards.

Focused unit and synthetic Chromium/WebKit checks cover exact names/doubles, group scope, stale selections, offline refresh, Back focus, preserved filters and narrow/enlarged text. Real iPhone acceptance and full release gates remain necessary before shipping.

## Combined competition beta

The local integration combines tournament entry and organizer review with the match/standings finders, exact entrant history and return navigation. Entry opens as an owned child sheet and device Back closes it before changing the selected division; the parent keeps independent match and standings filters. Parent disposal and account changes clear private replies. Production migration permission/catalog checks and read-only caller-role checks are verified separately. A new app build is not published by that database update.
