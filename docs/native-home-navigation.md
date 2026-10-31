# Native home and tennis navigation

The app keeps five stable bottom destinations: **My Lab, Explore, Chats, Compete, More**. The bottom bar does not scroll. All five targets stay visible on a narrow phone. A full-screen team conversation hides the bar to keep the message composer clear; the Chats inbox retains the bar.

- **My Lab:** the linked player's TIQ scoreboard first, then recent individual-court form, shortcuts, result evidence and training. Overall, Singles and Doubles still use the existing recorded values and explicit fallback labels. Team scorecard totals are excluded from personal form.
- **Compete:** direct Leagues and Tournaments entry, plus League Office and team/captain tools. Leagues opens connected public TiQ entries; imported league intelligence remains in Explore → Leagues. Tournaments opens its existing event, division, draw, standings and registration flow without first opening the league sheet.
- **More:** Following, Matchup, Coach & training, Leagues, Tournaments, League Office, Teams & captain tools, Uploads & imports and Account. Following and Matchup retain their existing access checks and highlight More while open.
- **Coach & training:** native student/assignment management, connection invitations and check-in review, plus weekly plans, practice cards and saved training progress. **Students & assignments** opens the native Coach workspace. Players accept invitations on the existing website page. **Advanced Coach tools** explicitly says **Opens website** for calendars and session planning. These entries do not grant coach access or change memberships. See [Native Coach workspace](native-coach-workspace.md).

The scoreboard uses the complete approved generic right-handed deuce-side court image from `public/brand/`, with proportional `object-fit: contain`. The repeated compact logo and inset background were removed from the metric area. The header logo, artwork bytes, server pose and colors are unchanged. A larger overall number, paired format ratings, quieter surfaces and dedicated quick actions establish the home hierarchy.

Navigation preserves current-owner/revision guards, closes direct tournament sheets on account changes and retains the selected hub through token refresh, app resume and reconnection. Direct tournament sheets use **Close**; tournaments opened inside Competitions retain their existing parent back label. Closing a sheet restores its initiating button.

## Verification

`tests/e2e/mobile-navigation.e2e.ts` bundles the actual native entry point with a synthetic local auth adapter and bounded fake API responses. It checks linked-player order, fixed tab labels, Chats, Following, Matchup, coach inbox, direct league/tournament routing, focus return, reconnect/token refresh, account invalidation and overflow at 320/390px. No real accounts, permissions or production data are modified.

The navigation checks pass in Chromium and WebKit, with larger-text reflow. Existing scoreboard checks cover unavailable/self-rated/fallback ratings, pending results, zero/all wins, long names, scorecard indexes and stale visits. These browser checks do not claim physical iPhone or Face ID testing. The native Swift, signing entitlements, storage, purchases and Face ID implementation are unchanged.
