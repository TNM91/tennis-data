# TiQ practice plans and player–coach alignment

Free players can turn a saved TiQ assessment into one private practice focus. Pro coaches can compare a player's explicitly shared self-assessments with their own observations, assign a practice block, and open outstanding work across their roster. These features use first-party records and the existing six-skill TiQ model.

## Player flow

My Lab → Your TiQ → **My improvement plan**. Choose a saved baseline, skill, measurable court target, 1–12 practices and a review date. One plan can be active at a time. Plans keep up to 24 dated practice notes and can be archived; the latest 25 summaries remain available in the screen. Assessment history can be paged when choosing a baseline or reassessment.

**Open drill** opens the matching existing training drill. Logging practice is a separate, explicit action. **Retake self-assessment** returns to the real TiQ questions; the player can then finish the plan with the newly saved assessment. Practice counts never increase a TiQ score. Deleted assessments are not retained inside plan payloads: their resolved baseline/review displays as removed.

An assigned coach block can be adopted using the player's own baseline. Its skill, target, count and date must match the current coach assignment. Baselines and practice logs remain private. **Prepare coach check-in** rechecks the current assignment and prefills the existing check-in editor; the player reviews and sends that check-in explicitly.

### Choosing what to share

**Prepare coach check-in** rereads the original plan and current assignment. The player sees the practice count and target, then selects any court notes to include. Notes start unchecked. The preview preserves their complete text; a selection over the existing 300-character proof limit asks the player to choose fewer notes. **Continue to check-in** rechecks the plan revision, assignment revision, matching block and coach connection before opening the existing editable recap. Assessment answers and IDs are not added to this recap.

**Send check-in** remains a separate action and explicitly completes the assignment. Discarding the unsent recap returns to the note choices. A failed preflight keeps those choices for retry; a changed plan or assignment returns to the latest plan for another deliberate selection. Account changes clear the chooser and ignore late reads. Uncertain sends use the existing saved-check-in lookup.

The plan shows **Awaiting coach feedback** after a confirmed check-in. Current coach feedback, its date and next focus appear on the plan after a refresh, including for a reviewed plan. A paused or unavailable connection hides that feedback. Updated assignment blocks direct the player to My Lab → Training inbox → Coach assignments. These reads happen only on opening, refresh or deliberate check-in actions; there is no polling, migration, new API endpoint or automatic note sharing.

**Add review to calendar** exports one calendar event with a stable UID and a reminder at the selected local time. The native file-sharing bridge already supports calendar files. The player finishes adding the event in their calendar, which controls the alert. This does not claim an APNs notification or a scheduled device alert, and exports no assessment answers, targets or private practice notes.

## Coaching flow

Coach workspace → student → Coach assessments → **Player & coach view**. Select the two dated sources. A coach sees only the self-assessments shared through that current connection. Partial coach observations say **Not observed**; they are never filled from the player's answers or converted into a coach-issued overall TiQ. Dates and court context remain visible.

**Plan practice block** creates an ordinary coach assignment with validated `tiqGrowth` metadata and its matching drill. Review precedes assignment. Existing quick drill assignments, player check-ins, coach feedback and follow-up tools continue to work.

The roster's **Up next for your players** section shows check-ins awaiting feedback, students needing a practice plan, and assigned blocks whose review date has arrived, oldest first. A row opens the exact student/assignment and reuses the existing write validation. A player awaiting feedback is not also told to start a new plan. Reads cover the latest 500 roster records and 2,000 assignments, return at most 25 attention rows, and label truncation. Errors are not displayed as zero tasks. The attention read updates its own region so a late reply cannot interrupt typing in roster search.

## Guided practice review

The plan's **Up next** action opens its drill, focuses the next practice log, starts a fresh assessment, or previews the latest eligible assessment when the practice target or review date is reached. These are deliberate actions; opening a drill or preview never logs practice or finishes a plan.

Both the review preview and the saved review show the starting and review dates, the chosen skill's self-rating labels and court descriptions. Higher, same and lower self-ratings are labelled as self-assessments. Missing or deleted assessments show that the comparison is unavailable. Practice counts never change a TiQ rating.

Review choices exclude the baseline, assessments saved before the plan, and assessment dates earlier than an existing baseline. Unsaved practice notes immediately disable navigation and review shortcuts until the player reviews the log or chooses to leave. This follow-up uses the existing account responses and migration; it adds no API call, collection job or database change.

## Returning from a drill

Opening the plan's drill keeps its court target visible and provides **Back to plan**. A confirmed training save offers **Review practice for plan**. Returning reloads the original plan from the account before preparing an editable practice date and note; it does not switch to a replacement plan or record practice automatically. Long training notes are shortened to the plan's 160-character limit with an explanation and remain editable. **Review practice log** and **Confirm practice** are still required.

The prepared log reuses the confirmed training session's UUID. A retry cannot count the same saved session twice. An uncertain training save must be verified using the existing account check before it can prepare a log. Archived, reviewed, missing, full or mismatched plans cannot receive the prepared session. Leaving an unfinished drill requires the existing discard decision; returning without a confirmed session invents no practice. Programmatic cleanup and account changes clear the private training context without reopening a plan. The flow adds no migration, background request or automatic coach sharing.

## Storage, authorization and cost

`20261120000200_native_tiq_growth.sql` reuses `my_lab_goals` under the owner-specific `tiq-growth:v1` namespace. It adds no table, collector, cron or paid service. Assessments are owner-filtered references, resolved on each read. The existing account-erasure path clears the plans; device erasure clears pending retries.

The RPCs are executable only by `service_role`. `/api/mobile/first-party/tiq/plans` derives its owner from a verified account and is available to free players. `/api/mobile/coach/overview` additionally requires current coaching access. Responses are private and uncached. Coach adoption checks the live, unblocked relationship and exact assigned block.

Owner-level transaction locking enforces one active plan. Revision checks prevent overwriting another device's edits. Stable operation and practice-log IDs preserve semantic receipts after later edits: an old retry cannot remove newer logs, reopen an archived plan or duplicate a completed practice. The native client keeps an uncertain operation in owner-scoped secure storage and offers explicit recovery after relaunch.

Plan, comparison, older-history and attention requests occur on opening or deliberate refresh. The roster overview uses one bounded RPC rather than a request per student. There is no background polling or automatic sharing.

## Verification and rollout

Run the focused database/contract/route tests, `tests/playwright.tiq-growth.config.ts`, the affected native navigation and assessment suites, then the repository's full verification. The launch audit uses current native components, synthetic account/email services and isolated PostgreSQL migrations. It does not establish real email delivery, physical iPhone alerts, StoreKit acceptance or a live migration.

The existing coach-assessment CI step includes the new plan, alignment and launch-journey browser cases; the dedicated growth config runs them alone during local iteration.

Apply the migration after the existing account-history migration, deploy the matching API once through the normal Git release lane, and then package the native client. Keep the currently selected public App Store review unchanged. This implementation alone does not upload a TestFlight binary or change tester-group assignment.

Local verification for the practice and coaching handoffs on November 20 passed the complete repository check: lint, TypeScript, 6,264 unit checks across 1,088 files, extension syntax and the Next.js production build. The first-party native bundle also built and opened at 390px without a page error or horizontal overflow. The production build's TypeScript check and final focused lint cover the last context-specific cancel-label change.

Chromium and mobile WebKit covered 50 TiQ/coaching cases. The broad run passed 48 and identified two new test assertions that assumed a native click retained checkbox focus in Safari. The corrected test explicitly exercises keyboard Space while other cases cover pointer selection; both widths in both engines passed. Four visual rechecks and eight final cancellation/standard-training checks also passed, along with 12 final focused unit checks. Captures at 320px with larger text and at 390px were inspected. Evidence is in `output/tiq-coach-check-in-20261120/`, with the prior drill-return evidence in `output/tiq-practice-return-20261120/`. Physical iPhone acceptance and the next release's CI remain separate checks. This follow-up made no cloud build, migration, deployment, App Store review change or TestFlight upload.
