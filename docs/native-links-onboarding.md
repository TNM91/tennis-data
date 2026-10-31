# Native shared links and player setup

The app handles supported TenAceIQ content links with the existing native views and server access checks. It does not exchange auth codes, change accounts, accept invitations, join teams or purchase memberships from a link.

## Supported destinations

- Coach invitations: `/coach/invite/<token>` opens the existing invitation preview. The invited email is still enforced by the server; accepting requires a separate action.
- Team invitations: `/team-room/join?token=<token>` opens the existing preview; joining requires confirmation.
- Team conversations: `/team-room?team=...&league=...&flight=...`, including validated named-room and message identifiers. Current team access is rechecked.
- TiQ leagues: `/explore/leagues/tiq/<id>` opens the selected public season, using the same competition API and registration flow.
- Published tournaments: `/tournaments/<id>` opens the existing native tournament detail and registration flow.
- Individual public scorecards: `/matches/<id>` (including canonical `via=scorecard-share`) opens the recorded court with neutral Side A/B results. Team totals, future courts and nonpublic courts are unavailable here. This never adds a personal win or alters ratings.

Only HTTPS content links on `www.tenaceiq.com` or `tenaceiq.com` pass the native parser. Unknown parameters, duplicated scope parameters, fragments, credentials, API/billing/auth routes, untrusted hosts and malformed identifiers are rejected. Website paths without native support retain their existing web behavior.

## Authentication and navigation

The App plugin registers `appUrlOpen` before checking `getLaunchUrl`. A late launch response cannot replace a newer arrival. A short duplicate delivery is ignored. One pending destination lives in memory for at most ten minutes and is cleared when consumed, dismissed, signed out, or switched to another account. Invitation secrets are never written to storage, history or logs.

A link opened while signed out continues after password, email-code or biometric sign-in through the existing session listener. A late first native delivery can open from an idle My Lab screen. Other arrivals show an Open link action. An existing modal must be closed first; unfinished team messages use the existing leave confirmation. Same-account token refresh preserves the current destination. Account changes dispose existing views and clear pending handoffs.

New/unlinked accounts see two practical steps in My Lab: find and explicitly confirm their own tennis record, then review a captain's team invitation. Existing linked players retain the scoreboard-first homepage. No onboarding database flag or dismissal storage is introduced; loading failures never masquerade as an unlinked account.

## iOS association and release gates

The static `/.well-known/apple-app-site-association` route identifies `6C5MPYLRVQ.com.tenaceiq.app`, verified against the existing production signing profile. Only the six supported content path families are associated. The production entitlement declares `applinks:www.tenaceiq.com`; the prototype/simulator identity claims no production domain. Apex links remain accepted when delivered or pasted, but the apex host is not declared because production may redirect it.

Enable Associated Domains for the existing App ID and refresh its App Store profile using the same distribution certificate. The signing validator rejects a profile without the required domain entitlement. Do not add auth, billing, webcredentials, wildcard domains or a custom URL scheme. Deploy and verify the association route before releasing the signed beta.

Local checks cover parsing, account changes, expiry, cold/warm races, sign-in continuation, invitation review, neutral scorecards, narrow phones and large text. The existing iOS simulator suite must pass against the candidate. Actual iPhone universal-link resolution and Coach camera/share gestures still require physical-device acceptance; browser and simulator evidence do not establish that result.

Public App Store submission and production sales remain outside this internal beta release.
