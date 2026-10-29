# iPhone subscriptions and launch readiness — U.S. first

Current audit: October 29, 2026. This replaces the pre-implementation plan in this file. The owner selected a U.S.-first launch with **Player and Captain**; Coach and Full-Court are not in the first Apple catalog.

## Implemented and released to internal TestFlight

TenAceIQ 1.0 build 166 is validated and available to the existing TenAceIQ Internal group. PR #1727 merged as `13c83e0ffafaf7732b3fb122b05104d1e8c13040`; the signed package matched the locally verified native JavaScript, CSS and approved assets. Required candidate and master CI passed. Local verification passed 5,404 tests; the import browser suite passed 40 Chromium/WebKit checks at 320/390px. These results do not establish physical iPhone purchase, restore, keyboard or accessibility acceptance.

Apple purchasing and restore **are implemented**. The native StoreKit bridge loads localized prices, binds explicit purchases to an authenticated account token, handles pending transactions, restores purchases and opens Apple subscription management. `mobile/src/apple-purchases.ts` and `mobile/src/apple-memberships.ts` own the app flow; `lib/apple-purchase-server.ts` and `lib/apple-purchase-api.ts` verify signed transactions and current subscription status. The server notification route is `app/api/apple/notifications/[environment]/route.ts`. Account help includes Apple purchase data and cancellation instructions.

The approved release setup is sandbox testing for a dedicated test account. Live sales have not been authorized or verified. A validated TestFlight build, completed local tests or an existing catalog do not establish successful real-device purchasing, production entitlement behavior or App Review acceptance.

## Apple catalog verified read-only

The October 29 App Store Connect API audit confirmed one group, **TenAceIQ Memberships**, with these two monthly subscriptions:

| Plan | Product ID | U.S. monthly price | Group level | Apple state | Review screenshot |
| --- | --- | ---: | ---: | --- | --- |
| Player | `com.tenaceiq.app.player.monthly` | $1.99 | 2 | Missing Metadata | Missing |
| Captain | `com.tenaceiq.app.captain.monthly` | $4.99 | 1 | Missing Metadata | Missing |

Both products have en-US names/descriptions and USA-only availability. Future territories, Family Sharing and multiseat purchasing are disabled. Prices match `lib/apple-membership-products.ts`, `lib/product-story.ts` and `lib/pricing-plans.ts`. Customer-facing prices still come from StoreKit; this table is setup evidence, not a replacement for Apple's localized price response.

The missing review screenshots are a confirmed gap, not proof of the sole cause of the earlier `products_not_found` response. Paid Apps, banking and tax status were not queried in this audit; the owner's earlier Processing status must not be treated as Active without a fresh check. Retest on the actual iPhone after completing catalog/business setup.

## App Store draft verified read-only

Version 1.0 remains **Prepare for Submission**, with manual release selected. No submission or public release was made.

| Item | Observed state | Next step |
| --- | --- | --- |
| Store description and keywords | en-US values present | Review against the actual first-release scope |
| Support URL | `https://www.tenaceiq.com/contact` | Verify the support journey before submission |
| Store screenshots | No screenshot sets | Capture the real app with authorized, non-private sample content |
| App Review login | Required; username and password blank | Prepare a dedicated reviewer account and sample team, then verify access |
| App Review contact | Incomplete | Have the owner provide the contact details |
| App Review notes | Present | Update after testing the chosen submission build |
| Selected submission build | None | Select the final verified build when the launch gates are clear |
| Content-rights declaration | Unset | Resolve the USTA/TennisLink rights question before declaring it |
| App Privacy answers | Not inspected by this API audit | Review actual app/server/SDK data handling and complete the declaration |

User-provided USTA/TennisLink spreadsheet exports must be distinguished from direct collection. The owner has sent USTA an email about permitted use and partnership/data access; the response remains pending. Do not infer that permission has been granted or complete a rights declaration from the fact that a user can export a file.

## Next work, in order

1. Prepare accurate App Store and subscription-review screenshots, reviewer instructions and a dedicated review account using approved sample content. Keep credentials out of this repository, screenshots and public PRs. Do not substitute synthetic browser fixtures for proof of a real StoreKit purchase.
2. Complete catalog metadata and confirm the owner's Paid Apps/banking/tax status. The owner handles legal acceptance and sensitive financial entry. Run the physical iPhone purchase, sync, restore, account-switch and cancellation/access checks in Apple's sandbox; a canceled test must not become an entitlement or a second charge.
3. Verify one known user export end to end on an iPhone, including Files selection, the keyboard, correction preview, duplicate handling and the saved individual courts/player totals. Finish VoiceOver, Dynamic Type, notification and session-lifecycle checks on the chosen submission build.
4. Verify privacy, content-rights and age-rating declarations and complete any missing answers; provide the final support/reviewer details. Keep unverified items explicit. Prepare screenshots and copy from the actual first-release capabilities.
5. Review the concrete final submission package with the owner. Public App Store submission, live sales and new tester invitations are outside standing internal-beta approval. Verify production entitlement rules and provider-event handling before enabling live Apple memberships.

Existing website members retain their current access while Apple's source-specific entitlement and deletion rules are verified. The long-term product is the app; redirecting the website later does not eliminate the server APIs, purchase verification, support, privacy or account-deletion endpoints.

## Evidence and scope

The read-only Apple audit checked app identity, version state, localization presence, screenshot sets, reviewer-field presence, selected build, subscription configuration, U.S. price points, availability and review screenshots. It did not expose reviewer secrets, enter financial information, create an account, change metadata, declare legal/privacy answers, enable sales or submit anything. Private timestamped receipts stay outside version control. This documentation correction needs document/source checks, not another cloud deployment or signed beta.

Sources checked October 29, 2026:

- [App Review Guidelines — completeness, account access, privacy and account deletion](https://developer.apple.com/app-store/review/guidelines/)
- [App privacy details — include relevant third-party data handling](https://developer.apple.com/app-store/app-privacy-details/)
- [Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Offer auto-renewable subscriptions](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/)
- [Submit an In-App Purchase — first subscriptions accompany an app version](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase)
- [Read a subscription's App Review screenshot](https://developer.apple.com/documentation/appstoreconnectapi/get-v1-subscriptions-_id_-appstorereviewscreenshot)

## Purchase preparation recovery candidate

The current candidate addresses unbounded native preparation and purchase-sheet context after a tester reported the whole app becoming unresponsive. It does not establish the cause of that physical-device freeze. On iOS 18.2+, purchase confirmation is tied to the actual attached, visible foreground controller; compatible scene/fallback APIs remain for older iOS. Presentation is rechecked after all asynchronous preparation, and another native modal prevents starting a purchase.

Earlier-purchase reads have a 15-second deadline and native purchase preparation a 30-second deadline. Expired continuations cannot start a purchase, resolve twice or release a newer operation's lock. The deadline ends before Apple's payment confirmation starts; that confirmation is not timed out or retried automatically. Client recovery checks coalesce, and a second purchase, restore or subscription-management operation is rejected while a purchase remains unresolved, including after closing/reopening account settings.

Progress and support codes distinguish earlier-purchase checks, preparation, confirmation, verification and finishing. Known pre-confirmation failures let the user explicitly retry; uncertain purchase results require Sync/Restore. Slow confirmation leaves the parent Close action available. These client/native changes require compilation and a launched JavaScript-to-native deadline probe on a Mac simulator, browser checks and a protected signed beta before another physical-device test. Test-only forced delays are injected exclusively into the generated unsigned Debug source and must be absent from the signed release.
