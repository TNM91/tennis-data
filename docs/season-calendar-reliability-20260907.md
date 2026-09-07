# Season calendar repair and verification

Status: implemented and verified locally; not published. No calendar subscriptions or personal calendar items were created in production during testing.

## User story

Teams → Season calendar → choose all or selected matches → save to TiQ → finish subscribing in Apple or Google Calendar, without leaving the team page to find setup controls.

## Confirmed defects addressed

- My Lab and Coach used `URL.protocol = 'webcal:'`. The URL implementation silently rejects conversion from the special HTTPS scheme to the non-special webcal scheme, leaving an HTTPS download instead of a subscription link. A regression test reproduces the behavior; links now explicitly replace the validated HTTP(S) prefix.
- Creating a personal-calendar link revoked every older active link. POST now adds a new hashed token without revoking existing devices. Explicit DELETE still disconnects all owner-scoped links. The live database indexes permit multiple active device links; only IDs and token hashes are unique. No migration is needed.
- Personal calendar reads and feeds stopped at the oldest 100 items. Owner-scoped, deterministically ordered paging now loads all pages, failing rather than publishing a partial feed on error or over the safety ceiling.
- Team schedule normalization did not accept PostgreSQL HH:mm:ss values. Those times now retain their hours/minutes instead of becoming all-day events.
- Shared iCalendar output lacked DTSTAMP and did not fold long UTF-8 content lines. Timestamps and lossless 75-octet folding are now tested.

## Experience changes

- The Season calendar deep link opens the controls, not another collapsed step.
- Clear Apple, Google and TiQ-only choices, selectable matches, save progress, partial-save errors, and stable retry IDs.
- Apple uses a real link after preparation so the native-app click retains browser user activation.
- Google bulk subscription instructions explicitly require a computer; individual-match Google links are available in the match list for phone users.
- Successful TiQ saving is distinguished from native calendar setup. An active feed token is no longer labeled as proof of subscription.
- Private-feed scope is disclosed: the link includes all dates in the user's TiQ calendar. Users are warned against subscribing twice in the same calendar app.
- One-time downloads are secondary, with time-zone selection. Personal feed and Google match times retain the current Central-time convention; per-event persisted time zones are not introduced in this change.
- Upload-derived schedule changes are not automatically mirrored from the source: re-save the updated schedule to TiQ. Calendar apps control subscription refresh timing.

## Verification evidence

| Boundary | Result | Evidence |
| --- | --- | --- |
| Live entry point | Inspected read-only | User's Teams page links to Season calendar; live team page has nine dated fixtures. |
| Phone UI | Passed locally | Synthetic fixture at 320px and 390px; desktop at 1280px; no horizontal overflow. All/one/empty selections, Apple link, Google instructions, signed-out and empty states checked with the in-app browser. |
| Client → API → outcome | Passed with synthetic storage | Two-match and one-match saves produced the expected success text; Apple handoff began with webcal and preserved the fixture token. Tests cover batches, partial saves, expired auth and malformed responses. |
| API → storage | Regression tests passed | Owner filters, multi-page loading and failure propagation; POST keeps prior tokens, DELETE revokes active owner-scoped tokens. Production indexes checked read-only for compatibility. |
| Production bundle | Passed locally | Actual team route loaded nine dated matches, one schedule anchor, expanded deep-link controls and no phone overflow. Signed-out state correctly requires sign-in to save. |
| Full regression | Passed | 514 test files, 2,555 tests; full lint, standalone TypeScript and Next production build with 245 static pages. Report: artifacts/team-season-calendar/regression-tests.json. |
| Native Apple/Google acceptance | Not verified | This Windows session cannot complete iPhone's Calendar subscription confirmation. No real provider calendar was modified. |

The standalone synthetic fixture is `scripts/verify-team-season-calendar.mjs`. Browser interaction in this task used the supported in-app browser runtime; the separately maintained Playwright verification script was updated but not executed in this session.

## Release/device acceptance

After publishing, use Teams → Season calendar. Verify Apple Subscribe on a real iPhone, check the selected dates and times, and confirm an older subscription still refreshes after another link is created. For Google, complete one bulk subscription on desktop and confirm it appears in the mobile app; test a single-match Save on the phone. Do not label a prepared link or an HTTP fetch as proof the user completed subscription.

References: [Apple calendar subscriptions](https://support.apple.com/en-ie/guide/iphone/iph3d1110d4/ios), [Google subscription setup](https://support.google.com/calendar/answer/37100?hl=en), [iCalendar specification](https://www.rfc-editor.org/rfc/rfc5545).
