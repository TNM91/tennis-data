# Your TiQ: account history and coach sharing

Your TiQ self-assessments can be saved to the signed-in player's account and restored on another device. Free players own their history. A coach with current Coach access can read only the individual assessments that a connected player has chosen to share. Coach observations remain a separate record and do not overwrite the self-rating.

## Player experience

- My Lab restores the current account assessment when available. The card identifies an account rating separately from a private device assessment. The six-skill calculation, optional singles/doubles scoring and drill recommendation retain their existing behavior.
- The final assessment step explains its save destination. **Save to my account** creates a new private snapshot. If account history cannot be loaded, the player can save on the device and add it to account history later. An edit keeps the destination selected when it began; a late background read cannot change a device save into an account upload.
- **Rating history & sharing** shows dated snapshots, all six skill levels and changes from the previous loaded assessment. Each request reads at most 25 assessments; **Load earlier assessments** reads the next page. Same-day assessments show their server save time. Dates use calendar-day semantics rather than device timezone conversion.
- Existing six-skill device assessments remain intact. **Assessments on this device** offers explicit account import for each available snapshot. The import identity derives from the owner, assessment date and canonical answers, so retrying an import or importing the same device copy twice does not create duplicate history. The older three-answer assessment remains on the device until the player completes the six-skill assessment.
- Sharing requires selecting a connected coach for one saved assessment. It does not share the rest of the player's history, and later assessments start private. **Stop sharing** revokes that snapshot. Account deletion removes account snapshots and share records; an individual snapshot also has a separate confirmed delete action. Deleting an account snapshot does not silently remove a distinct device-only copy.

## Coach experience

From the selected student's Coach assessments, **Player self-assessments** opens a read-only history of shared snapshots. The screen labels them as the player's own ratings. Coach observations and drill assignment keep their existing flow. An unavailable or revoked coach read clears the displayed answers. Closing the nested history returns to the original coach action.

## Ownership, retries and access

`/api/mobile/first-party/tiq` uses verified bearer identity and private, no-store responses. Owner reads and writes do not require Pro; student reads require current Coach access. Caller-supplied owners, unknown fields, malformed dates/answers and unsupported scoring versions are rejected. The server accepts answers, never a caller-supplied TiQ score.

The migration creates private assessment and share tables, with RLS and no direct client or service table grants. Only the service-role RPCs execute through the verified HTTP handlers. Coach reads recheck the selected relationship, player and coach identities, connection revision, account eligibility and blocks. A changed connection requires a deliberate re-share. Revoking remains available when the original coach connection has changed.

New assessments are immutable and owner-serialized. A save compares the expected account head so a stale device cannot silently replace a newer rating. The owner-scoped save operation and answers are persisted before the HTTP write. After a lost reply, **Check saved assessment** retries the same identity. A conflict retains the answers and requires refreshing and reviewing the latest history before explicitly resaving. Share/revoke operations also compare the previously observed operation token; an old retry cannot undo a newer sharing decision.

The private tables use deletion cascades for account and relationship references. The account-erasure integration test applies this migration with the audited production schema, verifies the existing catalog guard, runs the erasure flow and confirms both new tables are cleared. No public column/FK catalog or erasure function body is changed.

## Cost and release

My Lab adds one bounded history RPC per mount. History refresh, older pages and sharing reads occur on deliberate actions. Coach connections are capped at 50 displayed rows with an explicit coverage message; shares are capped at 50 connections per assessment. There is no background polling, scheduled job, new paid service, source-data import or USTA dependency.

Apply `supabase/migrations/20261120000100_native_tiq_account_history.sql`, deploy the matching API, and then package the updated native client. Until that rollout, the current TestFlight build has its existing device-only behavior. The new client preserves device assessment access when the account API is unavailable.

The feature uses isolated PostgreSQL, HTTP-handler, storage/retry and two-engine browser verification, including a fresh second-device browser context. Those checks do not establish physical iPhone acceptance or a live migration. Keep the currently selected App Store review build unchanged during this implementation; the next internal beta and any later public candidate have separate release checks.

## Verification commands

```powershell
npm run verify
npx playwright test --config=tests/playwright.coach-assessment.config.ts --workers=2 --retries=0
```

The existing Coach assessment CI step includes the account-history browser cases. The dedicated `tests/playwright.tiq-account.config.ts` runs just the new feature when a focused check is appropriate. Package and check the first-party native bundle before its next TestFlight release.

Local verification on November 20 passed full lint, typecheck, extension syntax and the Next.js production build. The final unit pass completed 6,227 tests across 1,081 files, including owner-scoped identifier isolation and the LF/CRLF account-erasure integration. Forty distinct browser scenarios passed in Chromium and WebKit: 16 account-history scenarios, 12 existing coach-assessment scenarios, eight opening-screen/notification/palette checks and four existing self-assessment/coach handoff checks. The final first-party native bundle built, and three signed-out local production requests confirmed authentication, rejected owner injection and private cache headers. These checks used fixtures or a local server, with no production writes, migration, deployment, tester assignment or public review change.
