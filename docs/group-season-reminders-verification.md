# Optional group availability reminders

## Captain and player flow

Teams → chosen team → Schedule → Season availability → Team availability (or Invite players) → **Group chat reminder · optional**.

Choose a match or the whole season, optionally set a reply deadline, prepare the message, then copy it into an existing group chat. Nothing is sent automatically. Preparing preserves existing replies and private links; stopped invitations remain stopped. The existing lineup builder and individual text flow are unchanged.

The shared URL contains team/league/flight/season scope and an optional match ID, never a personal response or calendar token. The recipient signs in using a free account. The read-only endpoint checks accepted scoped membership and the profile's canonical roster identity before returning only that player's active invitation. It cannot create membership, select a different player, create an invitation, or revive a stopped one. Account and scope changes unmount the response editor. Existing personal links retain their no-login behavior.

For a weekly request, the requested match opens first. Other season dates and Apple/Google/TiQ calendar options are optional disclosures. Availability is explicitly separate from final lineup confirmation.

## Verification — September 7, 2026

- Focused tests: 32 passed across message generation, group preparation, and the recipient authorization boundary.
- Full suite: 526 files / 2,674 tests passed.
- TypeScript: passed; final production build including TypeScript passed.
- Full ESLint pass: zero errors and warnings.
- React loading-state lint errors found and fixed by passing request query parameters from the server page and deriving initial loading state without synchronous effect resets.
- Synthetic browser: prepared/copied a weekly group message; switched to whole season; saved one player's Yes; captain overview changed to 1 available / 2 unanswered; remaining 13 dates stayed unanswered. Calendar disclosure exposed all 14 dates and Apple/Google/TiQ actions.
- Synthetic phone previews: 320px recipient and 390px captain layouts inspected; no squished text or horizontal overlap observed. Group reminder collapsed by default. Expanded fields received explicit spacing and inherited typography.
- Production-bundle browser smoke: shared route renders signed-out instructions and sign-in/free-account links preserving the team/match return URL.

Browser preparation/replies used only the local synthetic fixture, not real invitations or production writes. API access checks used mocked service data. Real-account roster linking, delivery through an external group chat, and native calendar saves were not exercised in this change. This branch has not been deployed.

Reproduce local synthetic UI with Node 22: set `TIQ_FIXTURE_PORT=3024`, run `node scripts/season-kickoff-browser-fixture.mjs`, open `/hub-fixture`, and prepare the message before opening its shared link. `/phone-fixture?width=320&view=recipient` previews the player view; omit `view` for the captain view. Appending `signedOut=1` to the synthetic shared page tests its signed-out UI.
