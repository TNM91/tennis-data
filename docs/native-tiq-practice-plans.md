# TiQ practice plans and player–coach alignment

Free players can turn a saved TiQ assessment into one private practice focus. Pro coaches can compare a player's explicitly shared self-assessments with their own observations, assign a practice block, and open outstanding work across their roster. These features use first-party records and the existing six-skill TiQ model.

## Player flow

My Lab → Your TiQ → **My improvement plan**. Choose a saved baseline, skill, measurable court target, 1–12 practices and a review date. One plan can be active at a time. Plans keep up to 24 dated practice notes and can be archived; the latest 25 summaries remain available in the screen. Assessment history can be paged when choosing a baseline or reassessment.

**Open drill** opens the matching existing training drill. Logging practice is a separate, explicit action. **Retake self-assessment** returns to the real TiQ questions; the player can then finish the plan with the newly saved assessment. Practice counts never increase a TiQ score. Deleted assessments are not retained inside plan payloads: their resolved baseline/review displays as removed.

An assigned coach block can be adopted using the player's own baseline. Its skill, target, count and date must match the current coach assignment. Baselines and practice logs remain private. **Prepare coach check-in** rechecks the current assignment and prefills the existing check-in editor; the player reviews and sends that check-in explicitly.

**Add review to calendar** exports one calendar event with a stable UID and a reminder at the selected local time. The native file-sharing bridge already supports calendar files. The player finishes adding the event in their calendar, which controls the alert. This does not claim an APNs notification or a scheduled device alert, and exports no assessment answers, targets or private practice notes.

## Coaching flow

Coach workspace → student → Coach assessments → **Player & coach view**. Select the two dated sources. A coach sees only the self-assessments shared through that current connection. Partial coach observations say **Not observed**; they are never filled from the player's answers or converted into a coach-issued overall TiQ. Dates and court context remain visible.

**Plan practice block** creates an ordinary coach assignment with validated `tiqGrowth` metadata and its matching drill. Review precedes assignment. Existing quick drill assignments, player check-ins, coach feedback and follow-up tools continue to work.

The roster's **Up next for your players** section shows check-ins awaiting feedback, students needing a practice plan, and assigned blocks whose review date has arrived, oldest first. A row opens the exact student/assignment and reuses the existing write validation. A player awaiting feedback is not also told to start a new plan. Reads cover the latest 500 roster records and 2,000 assignments, return at most 25 attention rows, and label truncation. Errors are not displayed as zero tasks. The attention read updates its own region so a late reply cannot interrupt typing in roster search.

## Storage, authorization and cost

`20261120000200_native_tiq_growth.sql` reuses `my_lab_goals` under the owner-specific `tiq-growth:v1` namespace. It adds no table, collector, cron or paid service. Assessments are owner-filtered references, resolved on each read. The existing account-erasure path clears the plans; device erasure clears pending retries.

The RPCs are executable only by `service_role`. `/api/mobile/first-party/tiq/plans` derives its owner from a verified account and is available to free players. `/api/mobile/coach/overview` additionally requires current coaching access. Responses are private and uncached. Coach adoption checks the live, unblocked relationship and exact assigned block.

Owner-level transaction locking enforces one active plan. Revision checks prevent overwriting another device's edits. Stable operation and practice-log IDs preserve semantic receipts after later edits: an old retry cannot remove newer logs, reopen an archived plan or duplicate a completed practice. The native client keeps an uncertain operation in owner-scoped secure storage and offers explicit recovery after relaunch.

Plan, comparison, older-history and attention requests occur on opening or deliberate refresh. The roster overview uses one bounded RPC rather than a request per student. There is no background polling or automatic sharing.

## Verification and rollout

Run the focused database/contract/route tests, `tests/playwright.tiq-growth.config.ts`, the affected native navigation and assessment suites, then the repository's full verification. The launch audit uses current native components, synthetic account/email services and isolated PostgreSQL migrations. It does not establish real email delivery, physical iPhone alerts, StoreKit acceptance or a live migration.

The existing coach-assessment CI step includes the new plan, alignment and launch-journey browser cases; the dedicated growth config runs them alone during local iteration.

Apply the migration after the existing account-history migration, deploy the matching API once through the normal Git release lane, and then package the native client. Keep the currently selected public App Store review unchanged. This implementation alone does not upload a TestFlight binary or change tester-group assignment.

Local verification on November 20 covered 6,248 unit checks across 1,085 files. The full run passed 6,247 and exceeded the five-second limit on the existing repository-wide brand scan while other checks were running; all five checks in that file passed in isolation in 2.4 seconds. No assertion or repository timeout was relaxed. Full source lint was completed, its single `prefer-const` finding was corrected, and final changed-file lint passed. TypeScript, the Next.js production build, the first-party native bundle, extension syntax and three signed-out local production API requests passed. The emitted production API was checked for the final overview validation.

The two-engine browser pass completed 58 TiQ/coaching checks and 14 affected native-navigation checks. Four narrow/standard layout checks were repeated after the final dropdown clearance fix. Fresh signup, captain invitation and coach-feedback captures were inspected and saved with the local visual audit. These are local checks; no cloud build, migration, deployment, App Store review change or TestFlight upload was made.
