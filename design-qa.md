# Player profile story design QA

- Primary visual truth: `C:\Users\nmein\.codex\generated_images\019fba12-8fbb-75b0-bc9c-95ecca0a3945\exec-6809758e-fac5-460f-8846-645a59ca796d.png`
- Desktop implementation: `artifacts/player-profile-redesign/implementation-desktop-final-1440x1024.png`
- Mobile implementation: `artifacts/player-profile-redesign/implementation-mobile-final-390x844.png`
- Focused Player ID capture: `artifacts/player-profile-redesign/implementation-mobile-player-id-390x844.png`
- Combined comparison: `artifacts/player-profile-redesign/design-comparison-desktop.png`
- Tested state: Nathan Meinert, linked team, verified 4.50 baseline, zero reviewed matches, Overall rating focus

## Comparison

The selected Tennis Journey concept and the implementation were normalized and reviewed side by side in one comparison image. The implementation preserves the concept's navy portal language, personalized player-first hero, single high-contrast next action, tennis journey hierarchy, athlete artwork, rating path, Player ID, share card, and restrained milestone treatment.

Intentional differences preserve the existing product shell and real application state: the production seven-lane portal navigation remains on desktop, the team-linked zero-data copy is generated from actual profile data, and the detailed rating journey begins directly below the hero. On mobile, the portal grid is consolidated behind the existing menu so the player story and next action appear immediately.

## Responsive and interaction checks

- Desktop was checked at a 1440 x 1024 browser viewport; captured application content was 1425 x 930 CSS pixels at 1x.
- Mobile was checked at 390 x 844; captured application content was 375 x 844 CSS pixels at 1x.
- No horizontal overflow was present at either viewport.
- Overview, Rating, Matches, Player ID, and Teams links were checked.
- Overall, Singles, and Doubles rating focus controls were exercised and returned to Overall.
- The first-scorecard and full Player ID actions resolve to their intended destinations.
- The share action is enabled with native sharing and a clipboard fallback.
- The mobile hamburger continues to expose the full site navigation.
- No browser console errors or warnings were recorded.

## Iterations

1. The mobile portal navigation consumed the first screen, so the profile now consolidates it behind the existing hamburger below 760px.
2. The primary mobile action inherited a stretched flex basis, so it was corrected to a compact one-touch action.
3. The public upgrade prompt interrupted the player story, so it was shortened and placed in a collapsed Personal tools disclosure.
4. The Player ID and milestone material competed with the main journey, so they were rebuilt as concise supporting chapters with real generated artwork.

## Final assessment

The page is personal, actionable, and consistent with the wider TenAceIQ portal. The first screen answers who the player is, where the rating stands, what is missing, and what to do next without exposing a wall of tools. Remaining deeper analytics stay available below the story without weakening the primary path.

Player profile result: passed

# Home icon and watermark design QA

- Icon reference: `C:\Users\nmein\.codex\codex-remote-attachments\019fba12-8fbb-75b0-bc9c-95ecca0a3945\B63F1A52-216C-41DA-88B0-A08C44E4DC30\1-Pasted-Image-1.jpg`
- Approved icon source: `public/brand/logos/tenaceiq-iq-navy.jpg`
- Installed icon comparison: `artifacts/brand-icon-watermark/comparison-home-icon.png`
- Watermark comparison: `artifacts/brand-icon-watermark/comparison-home-watermark.png`
- Mobile implementation: `artifacts/brand-icon-watermark/home-watermark-mobile.png`

## Comparison

The source iPhone capture showed the transparent white-and-lime IQ mark disappearing against the light home-screen surface. The rebuilt Apple, PWA, and favicon assets use the approved navy logo as a full-bleed background, preserving the refreshed IQ artwork while restoring immediate contrast.

The original home treatment enlarged the 1552-pixel compact raster twice: once inside the hero and again as a page atmosphere mark. The combined screenshot showed visible edge artifacts and competing oversized marks. The implementation uses one restrained watermark derived from the 6118-pixel approved full lockup and removes the duplicate home-page atmosphere layer.

## Verification

- The Apple touch icon is 180 x 180, RGB, and fully opaque.
- PWA icons are present at 192 x 192 and 512 x 512.
- The favicon contains 16, 32, 48, 64, 128, and 256 pixel RGBA PNG frames and is accepted by Next.js.
- Desktop was checked at 1280 x 720 and mobile at 390 x 844.
- The home page has no horizontal overflow at either viewport.
- Browser metadata resolves to the approved brand icon paths.
- The high-resolution watermark remains subtle, readable, and does not compete with the primary action.

final result: passed

---

# Format-aware captain scorecard and practice RSVP QA

- Target viewport: 390 x 844 CSS pixels in the authenticated captain experience.
- Routes checked: `/compete/teams`, `/captain/practice`, `/team-room`, and `/captain/matchup-sheet`.
- Print artifact checked: `output/pdf/tenaceiq-captain-scorecard-preview.pdf` at US Letter portrait.

## Findings

No actionable P0/P1/P2 issue remains in the implemented scope.

- Scorecards now infer the season shape from the saved lineup and league labels. Regular, doubles-only, mixed, and rating-based Tri-Level formats retain their exact court labels.
- Singles opponent rows provide one uninterrupted handwriting area. Doubles opponent rows provide two distinct name slots.
- The printed scorecard is one page, uses the approved TenAceIQ logo, and keeps all court and score borders visible.
- Captain team cards and Team Chat expose a compact `Plan practice` action with the selected team already scoped.
- The mobile practice form keeps setup fields readable, reviews the final invite in a drawer, posts to Team Chat, and prepares a group-text link.
- Practice replies are grouped by In, Maybe, Out, and Waiting, with player names visible to the team.
- Browser console review showed no page errors or warnings beyond the normal development-runtime messages.

## Interaction notes

- A sample practice was prepared through the review step only. The final send action was intentionally not submitted during QA so no real team message or RSVP thread was created.
- Team Chat loaded the scoped `Plan practice` shortcut after the existing room data resolved.

final result: passed

---

# Team Chat, final-lineup delivery, and scorecard print QA

- Source visual truth: `C:\Users\nmein\.codex\visualizations\2026\09\01\01a05eb9-7774-7440-9217-9154c15d360d\team-chat-audit\01-room-current-viewport.jpg` plus the reported scorecard border defect.
- Browser-rendered Team Chat implementation: `tmp/design-qa/team-chat-after.png`.
- Browser-rendered scorecard detail: `tmp/design-qa/scorecard-borders-after.png`.
- Combined Team Chat comparison: `tmp/design-qa/team-chat-comparison.png`.
- One-page PDF proof: `output/pdf/tenaceiq-captain-scorecard-preview.pdf` with Poppler render at `tmp/pdfs/rendered/scorecard.png`.
- Viewport and state: 390 x 844 CSS viewport override, authenticated captain, dark Team Chat, current confirmed five-court lineup. In-app browser captures were 375 x 750 pixels at 1x after browser chrome; the side-by-side comparison normalizes both content captures to 390 x 844.

## Findings

No actionable P0/P1/P2 differences remain for the requested mobile workflow.

- Fonts and typography: the condensed mobile header, match strip, quick actions, reply context, and score headers remain readable without letter-by-letter wrapping. The reply close action stays on one line.
- Spacing and layout rhythm: secondary room controls now live behind one compact Team options disclosure; the confirmed match plan is collapsed by default; the composer stays fixed and compact while messages scroll behind its measured inset.
- Colors and visual tokens: existing TenAceIQ navy, lime, blue, and semantic status tokens are preserved across chat, the scorecard, and the PDF proof.
- Image and asset fidelity: only approved `public/brand/` logo assets are used. No logo, navigation icon, or product mark was redrawn or filtered.
- Copy and content: the final-lineup state now exposes the three captain outcomes directly: Post to Team Chat, Create image + text team, and Print lineup / scorecard.

## Comparison history

1. Earlier P1: the room header consumed most of the first mobile screen. The implementation keeps team identity and Members in the app bar, moves secondary controls into Team options, and places the latest conversation immediately below a compact match strip.
2. Earlier P1: the pinned confirmed lineup opened as a large card and displaced the conversation. It now opens collapsed unless a final result or explicit focus requires expansion.
3. Earlier P2: Quick notes and reply controls competed with the composer. Quick notes now open as a bounded, scrollable sheet above the dock, and Close remains a stable one-line action.
4. Reported P1: opponent score cells lost visible borders in print. Both the screen print stylesheet and popup scorecard HTML now draw explicit grid borders on every opponent score cell. The rendered PDF proof is one US Letter page and preserves all opponent-row borders.

## Interaction and runtime checks

- Opened and closed Team options.
- Opened the Quick notes sheet.
- Entered reply mode and verified the Close action remains aligned.
- Verified the confirmed match strip is collapsed by default and expandable.
- Verified the matchup sheet loads five saved courts and renders every score column border at phone width.
- Browser console errors and warnings: none.
- Focused browser regions were used because the score-grid border and composer controls are too small to judge reliably from only the full-page comparison.

final result: passed

---

# Desktop and tablet watermark visual QA

Final result: **passed**

## Sources and capture details

- Reference screenshot: `C:\Users\nmein\AppData\Local\Temp\codex-clipboard-0c878160-85b1-48b3-8538-e6af5d70fa9c.png` (1293 x 556, signed-in Improve hub).
- Desktop implementation: `docs/qa-evidence/watermark-desktop-after.png` (1293 x 556, public Explore home).
- Tablet implementation: `docs/qa-evidence/watermark-tablet-after.png` (1024 x 768, public Explore home).
- Side-by-side comparison: `docs/qa-evidence/watermark-desktop-comparison.png`.
- The authenticated reference state was not available locally. The watermark is a shared global layer, so this comparison is limited to its rendering, scale, opacity, and relationship to foreground content.

## Evidence and comparison history

1. The supplied 1552 x 1614 watermark source previously rendered at 1034.39 x 1075.7 CSS pixels at the 1293 px desktop viewport. A 2x display therefore requested about 2069 x 2152 source pixels and upscaled the raster.
2. The revised desktop hub watermark renders at 776 x 807 CSS pixels and 0.16 opacity. At 2x, its requested width is exactly 1552 pixels, matching the source width.
3. The revised tablet hub watermark renders at 680 x 707.16 CSS pixels and 0.16 opacity. At 2x, its requested width is 1360 pixels, below the source width.
4. `background-size: contain` remains in effect. No cropping, stretching, filter, shadow, rotation, or border radius is applied to the approved artwork.
5. Browser console warnings/errors: none.

The oversized-raster P2 issue is resolved. No remaining P0, P1, or P2 visual issues were found in the watermark layer.

---

# Premium Team Discovery design QA

- Source visual truth: `C:\Users\nmein\.codex\generated_images\01a01d3a-e317-7831-8f3a-1c13c4c795e8\exec-36477341-1b31-4b59-907f-4d41043a3adc.png`
- Target viewport: 390 × 844 mobile web content.
- Intended state: public Team Discovery after **Browse teams** or a search/filter selection.
- Implementation route: `/teams`.
- Implementation screenshot: unavailable.

## Blocking evidence gap

The local page returned HTTP 200, but the required browser-control runtime could not establish a trusted browser-service connection in this environment. No browser-rendered mobile capture, same-viewport comparison, interaction test, or console check is available.

## Code-level verification

- Focused Team/mobile tests passed.
- Full suite passed: 404 files, 1,982 tests.
- Typecheck, lint, and production build passed.

## Required follow-up

Capture `/teams` with directory results visible at 390 × 844, compare it with the source visual, and resolve any responsive layout issue before visual approval.

final result: blocked

---

# Captain lineup intelligence design QA

- Source visual truth path: `C:\Users\nmein\.codex\generated_images\01a097f7-f6d6-7610-b5e5-43c9af75cefe\exec-c0c43b6a-6099-4c60-84c1-737d4544f726.png`
- Browser-rendered implementation: `artifacts/captain-lineup-mobile-loaded.png`
- Missing-roster implementation: `artifacts/captain-lineup-mobile.png`
- Player-lens implementation: `artifacts/captain-lineup-player-lens.jpg`
- Full page capture: `artifacts/captain-lineup-full-page.jpg`
- Full-view comparison: `artifacts/captain-lineup-comparison.png`
- Focused lens comparison: `artifacts/captain-lineup-lens-comparison.png`
- Route: `/captain/lineup-builder`
- Viewport: 390 × 844 CSS pixels, 1x device density; rendered content width is 375 pixels after the browser scrollbar.
- Source pixels: 853 × 1844. The source was proportionally normalized to 375 × 811 for comparison.
- Implementation pixels: the browser viewport captures are 375 × 812; the full page is 375 × 4369. The Captain win-path region measured 351 × 938 CSS pixels and was normalized to 375 × 1002 in the combined comparison.
- State: signed-in Captain. Both a loaded USTA opponent roster (Tri-Level, three courts, six opponent players) and a missing USTA opponent roster (five courts) were checked. The source depicts a loaded five-court roster and an open player lens, so dynamic team format and real player history account for the documented content differences.

## Findings

No actionable P0, P1, or P2 differences remain.

- [P3] The implementation uses a compact semantic probability rail instead of the concept's illustrated mini-court tiles.
  Location: Captain win-path projected result.
  Evidence: the source uses five pictorial court tiles; the implementation uses one segment per real match court followed by labeled lineup rows with percentages.
  Impact: the implementation is less decorative, but it remains immediately scannable and adapts correctly to three-court Tri-Level and five-court formats.
  Disposition: accepted. It avoids a fixed five-court visual and keeps the real court rows as the primary evidence.

- [P3] Generated player portraits were not carried into production.
  Location: lineup rows and player lens.
  Evidence: the source concept uses illustrative avatars; the available live roster does not provide verified player photos.
  Impact: the production view is visually quieter but does not misrepresent real players.
  Disposition: accepted until verified player imagery exists.

## Required fidelity surfaces

- Fonts and typography: the implementation preserves the portal's approved bold display hierarchy, blue uppercase eyebrow treatment, readable body copy, and clear percentage emphasis. Real names and labels wrap without clipping. It uses larger small-text sizing than the concept where needed for phone readability.
- Spacing and layout rhythm: the win-path hierarchy, roster state, result, court rows, player lens, and sticky strategy actions retain the source order. The implementation is taller because it preserves 44-pixel touch targets and allows real team/player names to wrap. No horizontal overflow was detected at 390 pixels.
- Colors and visual tokens: navy surfaces, blue dividers, lime primary actions, blue evidence bars, and green/gold/red semantic states match the concept and existing TenAceIQ tokens. Contrast remains strong in both roster states.
- Image quality and asset fidelity: approved TenAceIQ assets remain in the shared shell. No fake avatars, placeholder player photos, handcrafted SVGs, emoji, or rasterized UI substitutes were introduced in the lineup intelligence component. The circular `N` visible over some development captures is the Next.js development toolbar, not production UI.
- Copy and content: USTA recovery instructions use the real TennisLink Team Summary → Send To Excel workflow. Court-position percentages, sample counts, outcome buckets, and matchup copy are derived from connected match history and clearly disclose missing data.
- Icons and controls: Phosphor icons match the app's existing icon family. Buttons, disclosures, and court rows retain practical mobile targets and semantic labels.
- Responsiveness and accessibility: the full 390 × 844 flow has no horizontal overflow. The player lens is a scrollable modal bottom sheet, focuses its close control, traps Tab navigation, returns focus to its trigger, closes by button, backdrop, or Escape, and keeps all roster/strategy states exposed semantically.

## Full-view comparison evidence

The combined comparison confirms the same decision sequence as the source: roster confidence, projected team result, court-by-court evidence, manual player inspection, and a strategy-aware auto-builder. The implementation replaces concept-only names and probabilities with the signed-in Captain's actual Tri-Level lineup and USTA roster. It also preserves the surrounding Team Hub rather than duplicating a second navigation shell inside the feature.

## Focused region comparison evidence

The focused lens comparison confirms matching position-tendency and score-distribution structures, matchup guidance, keep/edit actions, and a dismiss control. The captured live player has no connected history, so the implementation correctly renders explicit evidence-empty states instead of fabricated chart values. A separate five-court player with history was opened and showed 50% Singles 1 / 50% Singles 2 tendency plus a four-bucket scored-win distribution.

## Comparison history

1. Earlier [P2] finding: the mobile missing-opponent recovery panel appeared twice before the win-path content.
   Fix: the legacy opponent entry panel now stays hidden on mobile until the Captain explicitly chooses **Enter names instead**; the integrated win-path panel owns the default USTA recovery guidance.
   Post-fix evidence: `artifacts/captain-lineup-mobile.png` shows one recovery sequence followed immediately by projected result and player evidence.
2. Earlier [P2] finding: the roster-help disclosure was controlled only by roster state, so the loaded-state **Roster missing?** action could not reliably reopen it.
   Fix: added explicit disclosure state, loaded/missing synchronization, and a semantic button trigger.
   Post-fix evidence: the loaded-roster capture shows the help panel collapsed, while the missing-roster capture shows it expanded automatically.
3. Earlier accessibility refinement: the player lens did not support keyboard dismissal.
   Fix: Escape now closes the active lens in addition to the visible close button and backdrop; modal focus is trapped and returned to the originating court row.
   Post-fix evidence: browser interaction confirmed the lens was no longer visible after Escape, with no console errors.

## Primary interactions tested

- Signed-in load and direct Captain team scoping.
- Missing USTA roster auto-prompt and loaded roster collapsed-help state.
- Five-court Adult and three-court Tri-Level formats.
- Player row → history lens, close button visibility, and Escape dismissal.
- Strategy selection (`Best odds`, `Safer floor`, `More upside`) and auto-builder activation.
- Real court-position and scored-win outcome rendering.
- Console error check: none.
- Focused suite: 6 files, 28 tests passed.
- Typecheck, lint, and production build: passed; 245 routes generated.

## Implementation checklist

- [x] Prompt Captains with concrete USTA TennisLink instructions when the opponent roster is missing.
- [x] Show loaded-roster confidence and matchup-level projected outcomes.
- [x] Show real court-position frequency and scored-win outcome distributions.
- [x] Support manual court inspection/editing and a strategy-aware auto-builder.
- [x] Preserve phone-first touch targets, honest empty states, and accessible dismissal.
- [x] Remove duplicate mobile recovery UI and verify real Adult/Tri-Level data.

final result: passed

# Captain quick matchup simulator design QA

- Source visual truth: `C:\Users\nmein\.codex\generated_images\01a097f7-f6d6-7610-b5e5-43c9af75cefe\exec-c0c43b6a-6099-4c60-84c1-737d4544f726.png`
- 390 px implementation: `artifacts/captain-lineup-simulator-390.png`
- 360 px implementation, top: `artifacts/captain-lineup-simulator-360-top.png`
- 360 px implementation, decision footer: `artifacts/captain-lineup-simulator-360-bottom.png`
- Route: `/captain/lineup-builder`
- Live state: signed-in Captain, loaded USTA Tri-Level opponent, confirmed lineup with protected players.

## Outcome

No actionable P0, P1, or P2 visual, interaction, responsive, or accessibility issues remain.

- Every populated court exposes one compact **Try a swap** action alongside its existing locks.
- The simulator uses the existing bottom-sheet visual language, navy surfaces, blue hierarchy, lime action, and Phosphor icons from the selected Win-Path direction.
- The captain chooses the outgoing singles player or doubles partner, then compares only unassigned, unlocked, competition-eligible replacements.
- Each candidate exposes rating, availability, court probability before/after, overall match probability before/after, percentage-point deltas, and the most relevant historical court-position evidence.
- Candidates are ranked by projected match outcome. The live 3.5 comparison correctly showed that both eligible alternatives reduced the current odds; the UI did not fabricate a favorable recommendation.
- Confirmed-player and court locks permit exploration but block application until explicitly unlocked.
- Applying a swap immediately recalculates the Win-Path, court role, evidence sample, strategy preview, and overall match odds without navigating away.

## Responsive and accessibility evidence

- At 360 px, document `scrollWidth` and `clientWidth` both measured 345 px after the browser scrollbar; the sheet measured exactly 345 px wide with no horizontal overflow.
- The sheet scrolls vertically when the candidate list exceeds the viewport, while preserving the close control and readable two-column Court/Match comparison cards.
- All simulator buttons measured at least 44 px high at the narrow breakpoint.
- On open, keyboard focus moves to **Close matchup simulator**; Escape dismisses the dialog and returns focus to the originating action.
- Swap-out controls expose tab semantics, candidate choices expose pressed state, locked guidance is a semantic note, and the selected-swap summary updates through a live region.
- Browser console check: no warnings or errors in the final simulator pass.

## Full interaction evidence

The live flow was exercised as: open 3.5 Doubles simulator → review Nick and Miles independently → compare Sean and Kaleb → unlock confirmed Nick → apply Sean → verify court odds changed from 60% to 56% and match odds from 54% to 53% → simulate Nick back → restore the original 60% / 54% state → confirm Nick was protected again. The captain's starting lineup was restored after QA.

## Reference fidelity

- Preserved from the selected direction: decisive mobile bottom sheet, large player choice, inline win probability, tennis-specific evidence, clear close action, and a lime primary decision.
- Intentionally extended: explicit before/after court and match odds, eligibility-ranked alternatives, and lock-aware application state.
- Intentionally omitted: generated player portraits, because the connected roster has no verified player imagery.

## Verification

- Focused simulator/mobile tests: 20 passed.
- Focused lint: passed.
- Typecheck: passed.
- Full test suite: 499 files, 2,382 tests passed.
- Production build: passed; 245 routes generated.

final result: passed

---

# Team Profile depth refinement visual QA

- Source visual direction: the selected Team Profile concept 2 (`C:\Users\nmein\.codex\generated_images\01a01d3a-e317-7831-8f3a-1c13c4c795e8\exec-d9dc93af-8a10-4081-a4e0-478f5caa8247.png`).
- Target viewport: 390 × 844 mobile web content.
- Implementation route: `/teams/[team]`.
- Intended state: a public team with completed results and a roster larger than four players.
- Implementation screenshot: unavailable.

## Blocking evidence gap

The required browser-control service still cannot establish its trusted runtime connection in this environment. A same-viewport rendered capture, focused comparison, interaction test, and console review are therefore unavailable.

## Implemented hierarchy

- Mobile results use one grouped, compact row surface per result group rather than a stack of large cards.
- Match history initially shows a short preview and requires an explicit action to open all results.
- Mobile roster starts as a four-player lineup snapshot. Full roster tools, comparison, and teammate search appear only after the visitor expands the roster.

## Required follow-up

Capture a populated team page at 390 × 844 and compare result-row density, roster expansion, touch targets, and horizontal overflow with the selected direction before visual approval.

final result: blocked

---

# Premium Team Profile concept 2 design QA

- Source visual truth: `C:\Users\nmein\.codex\generated_images\01a01d3a-e317-7831-8f3a-1c13c4c795e8\exec-d9dc93af-8a10-4081-a4e0-478f5caa8247.png`
- Target viewport: 390 × 844 mobile web content.
- Intended state: public team profile with completed matches, roster context, and no linked Captain permission.
- Implementation route: `/teams/[team]`.
- Implementation screenshot: unavailable.

## Blocking evidence gap

The local Next development server was available at `http://localhost:3000`, but the required browser-control runtime could not establish its trusted browser-service connection. No browser-rendered 390 × 844 capture, focused region capture, interaction check, console check, or source-to-implementation comparison could be completed.

## Implemented alignment

- The existing page now leads with the selected concept's real record, computed win rate, roster count, five-result form markers, singles/doubles split, and one latest-result link.
- The detailed schedule remains the single full match-history destination; the overview does not render a second result list.
- Captain planning remains role-aware and uses the centralized Captain product story rather than exposing private tools to public visitors.

## Required follow-up

Capture a public `/teams/[team]` page at 390 × 844 with completed results and compare the header, metrics, format split, latest-result row, and Captain teaser against the source visual. Resolve any P0/P1/P2 responsive or hierarchy differences before visual approval.

final result: blocked

---

# Mobile Team Chat and live scorecard formatting QA

- Source visual truth: `C:\Users\nmein\.codex\codex-remote-attachments\01a05eb9-7774-7440-9217-9154c15d360d\65EE78AB-E0CB-4AA3-B843-6C6D21759D02\1-Photo-1.jpg` and `2-Photo-2.jpg`.
- Rendered implementation: `C:\Users\nmein\.codex\visualizations\2026\09\01\01a05eb9-7774-7440-9217-9154c15d360d\team-chat-composer-mobile-after.jpg` and `scorecard-mobile-after.jpg`.
- Viewport and state: 390 x 844 CSS pixels, 1x browser capture, dark theme, compact Team Chat composer and captain live-scorecard entry.
- Pixel normalization: source captures are 591 x 1280 device screenshots; Team Chat implementation is 390 x 844; full scorecard implementation is 375 x 2510. Matching content regions were compared, excluding browser chrome and density-only differences.

## Findings

No actionable P0/P1/P2 differences remain for the reported defects.

- Fonts and typography: scorecard labels no longer break letter-by-letter; composer labels remain legible at phone width.
- Spacing and layout rhythm: the scorecard title and actions use separate mobile rows; the fixed composer is a compact 186px footer instead of covering roughly half the screen.
- Colors and tokens: existing TenAceIQ dark, blue, and green tokens remain unchanged.
- Image and asset fidelity: no logos or imagery were replaced, redrawn, filtered, or degraded.
- Copy and content: existing task labels and actions are preserved.

## Comparison history

1. Initial P1: live-scorecard court headings were compressed beside the action buttons. The court heading now stacks above a full-width action grid; post-fix evidence shows complete `MATCH LINE` and `Doubles 1` labels.
2. Initial P1: the fixed Team Chat composer obscured too much recent conversation. A one-row textarea, tighter padding, compact quick actions, and a two-column action row reduce the footer while keeping every action visible.

Focused region comparisons were required because both defects were localized UI failures. The source and implementation regions were opened together and checked for wrapping, control visibility, overlap, hierarchy, and touch sizing. No residual P0/P1/P2 issue was found.
# Captain lineup intelligence final QA pointer

The complete Captain lineup intelligence report, evidence paths, comparison history, fidelity review, interaction coverage, and verification results are recorded above under **Captain lineup intelligence design QA**. That feature's browser-rendered QA is independent of the older Team Profile evidence gaps retained in this shared report.

final result: passed

---

# Captain lineup intelligence refinement QA

- Source visual truth: `C:\Users\nmein\.codex\generated_images\01a097f7-f6d6-7610-b5e5-43c9af75cefe\exec-c0c43b6a-6099-4c60-84c1-737d4544f726.png`
- Loaded matchup evidence: `artifacts/captain-lineup-refinement-loaded-top.png`, `artifacts/captain-lineup-refinement-courts.png`, and `artifacts/captain-lineup-refinement-strategy.png`
- Partner lens evidence: `artifacts/captain-lineup-refinement-partner-lens.png`
- Auto-builder explanation evidence: `artifacts/captain-lineup-refinement-why.png`
- Missing USTA roster evidence: `artifacts/captain-lineup-refinement-missing.png`
- Narrow-phone evidence: `artifacts/captain-lineup-refinement-360.png`
- Route: `/captain/lineup-builder`
- Viewports: 390 × 844 and 360 × 800 CSS pixels.
- Live states: signed-in Captain with a loaded three-court USTA Tri-Level matchup and a five-court Adult matchup whose opponent roster is missing.

## Outcome

No actionable P0, P1, or P2 visual, interaction, responsive, or accessibility issues remain.

- Win-path intelligence now sits directly below Match Week in a scoped phone flow, ahead of lineup setup controls.
- Both doubles partners expose independent court-position and score-outcome evidence in one bottom-sheet player lens.
- Court and player locks are visible beside every assignment and are honored by strategy previews and rebuilds.
- Strategy previews disclose current versus proposed odds, projected score, and changed courts before application.
- Auto-build stays at the decision surface and opens a court-by-court **Why this lineup?** comparison instead of jumping to the legacy editor.
- Confidence labels expose the available opponent and historical sample quality; missing evidence remains explicit rather than inferred.
- The missing-roster state opens the USTA TennisLink Team Summary → Send To Excel instructions automatically and provides upload and manual-entry paths.

## Responsive and interaction evidence

- 390 px: loaded roster, all three Tri-Level courts, partner switching, strategy comparison, explanation, locks, and manual-edit handoff were browser verified.
- 360 px: document `scrollWidth` and `clientWidth` both measured 345 px after the browser scrollbar, confirming no horizontal overflow.
- Roster-help, court-lock, strategy, build, and edit controls measure at least 44 px high at the narrow breakpoint.
- Auto-locked confirmed players remain in their current court assignments after rebuild; the live preview correctly reports **Current courts already match**.
- Modal focus, partner tabs, close action, and readable empty-history states remain intact.
- No feature-originated console errors were found. The development browser reported only Fast Refresh notices and a third-party AdSense `no_div` error outside the lineup component.

## Reference fidelity

- Preserved: navy/lime visual language, projected result hierarchy, semantic court outlook, court-by-court evidence, player lens, and three-strategy auto-builder.
- Intentionally extended: compact confidence badges, both-partner evidence, explicit locks, pre-build strategy delta, and post-build rationale.
- Intentionally omitted: generated player portraits and decorative court illustrations, because the live roster has no verified player imagery and the real competition format may contain three or five courts.

## Verification

- Focused lint: passed.
- Typecheck: passed.
- Full test suite: 499 files, 2,381 tests passed.
- Production build: passed; 245 routes generated.

final result: passed

---

# Captain quick matchup simulator final QA pointer

The complete simulator report, reference comparison, 390 px and 360 px evidence, accessibility checks, lock-aware apply-and-restore flow, and final verification results are recorded above under **Captain quick matchup simulator design QA**.

final result: passed

---

# Captain simulator odds-factor QA

- Source visual: `C:\Users\nmein\.codex\generated_images\01a097f7-f6d6-7610-b5e5-43c9af75cefe\exec-c0c43b6a-6099-4c60-84c1-737d4544f726.png`
- Browser evidence: `artifacts/captain-lineup-simulator-factors-390.png` and `artifacts/captain-lineup-simulator-factors-360.png`
- Live state: signed-in Captain, loaded USTA Tri-Level matchup, Doubles 2 swap simulator with the odds-factor explanation expanded.

## Outcome

No actionable P0, P1, or P2 visual, interaction, responsive, or accessibility issues remain.

- **Why the odds moved** clearly separates the rating edge that drives the displayed probability from supporting court-history, score-profile, and availability evidence.
- Factor values and details update with the selected replacement candidate; Sean and Kaleb were browser-verified against the same outgoing player.
- Supporting evidence is explicitly labeled and is not presented as part of the modeled percentage, avoiding fabricated precision.
- The explanation stays compact by default, expands in place, and does not alter the lineup until the captain chooses **Apply swap**.

## Responsive and accessibility evidence

- 390 px and 360 px presentations keep the factor hierarchy readable inside the matchup sheet.
- At 360 px, document `scrollWidth` and `clientWidth` both measured 345 px, confirming no horizontal overflow.
- The disclosure summary measures 48 px high and uses text, icons, and labels rather than color alone.
- No feature-originated console errors or warnings were found in the final browser state.

## Verification

- Focused lint: passed.
- Focused tests: 3 files, 20 tests passed.
- Typecheck: passed.
- Full test suite: 499 files, 2,382 tests passed.
- Production build: passed; 245 routes generated.

final result: passed

---

# Captain opponent-scenario stress test QA

- Source visual: `C:\Users\nmein\.codex\generated_images\01a097f7-f6d6-7610-b5e5-43c9af75cefe\exec-c0c43b6a-6099-4c60-84c1-737d4544f726.png`
- Browser evidence: `artifacts/captain-lineup-opponent-scenarios-390.png` and `artifacts/captain-lineup-opponent-scenarios-360.png`
- Live state: signed-in Captain with a loaded USTA Tri-Level matchup; Likely, Aggressive, and Conservative scenarios exercised.

## Outcome

No actionable P0, P1, or P2 visual, interaction, responsive, or accessibility issues remain.

- The new scenario card preserves the reference hierarchy and navy/lime decision language without crowding the projected-result summary.
- Each scenario updates the projected court rail, individual court odds, weak-point callout, matchup simulator, and Auto Builder inputs.
- Likely respects entered opponent courts or a balanced inferred lineup. Aggressive and Conservative use the strongest eligible roster in different legal arrangements.
- Scenario movement is constrained by court type and rating level, so Tri-Level players are never moved across ineligible levels to manufacture a result.
- When the opponent roster cannot produce a genuinely different legal lineup, the projections remain unchanged rather than implying false uncertainty.

## Responsive and accessibility evidence

- At 390 px, the complete scenario card, all three tabs, pressure point, and the first updated court remain readable in one continuous phone flow.
- At 360 px, document `scrollWidth` and `clientWidth` both measured 345 px, confirming no horizontal overflow.
- Scenario tabs are exposed as a tablist with selected state and 44 px minimum touch targets.
- The pressure point uses text and an icon in addition to color; live scenario results are announced through a polite status region.

## Verification

- Focused lint: passed.
- Focused tests: 2 files, 19 tests passed.
- Typecheck: passed.
- Full test suite: 499 files, 2,383 tests passed.
- Production build: passed; 245 routes generated.
- Diff whitespace check: passed.

final result: passed

---

# Captain all-scenario resilient builder QA

- Source visual: `C:\Users\nmein\.codex\generated_images\01a097f7-f6d6-7610-b5e5-43c9af75cefe\exec-c0c43b6a-6099-4c60-84c1-737d4544f726.png`
- Browser evidence: `artifacts/captain-lineup-resilient-builder-390.png` and `artifacts/captain-lineup-resilient-builder-360.png`
- Live state: signed-in Captain, Aggressive opponent scenario selected, confirmed-player locks active, resilient build applied.

## Outcome

No actionable P0, P1, or P2 visual, interaction, responsive, or accessibility issues remain.

- **Build for all 3** sits inside the opponent-scenario card, keeping the cross-scenario choice attached to the evidence it uses.
- The preview exposes the worst-case floor, average outlook, and changed courts before application.
- Candidate lineups are tested against every legal opponent scenario; the lowest projected result receives 70% of the selection score and the scenario average receives 30%.
- Court and player locks are applied before the preview and preserved when the resilient lineup is built.
- The live locked lineup already matched the resilient recommendation, and the interface stated that clearly while still confirming the applied action.

## Responsive and accessibility evidence

- At 390 px and 360 px, the recommendation and full-width primary action fit inside the scenario card without crowding the three scenario tabs.
- At 360 px, document `scrollWidth` and `clientWidth` both measured 345 px, confirming no horizontal overflow.
- The resilient action measures 46 px high, uses a Phosphor shield icon plus text, and retains visible contrast in the navy/lime system.

## Verification

- Focused lint: passed.
- Focused tests: 2 files, 19 tests passed.
- Typecheck: passed.
- Full test suite: 499 files, 2,383 tests passed.
- Production build: passed; 245 routes generated.
- Diff whitespace check: passed.

final result: passed

---

# Captain opponent lineup reveal QA

- Source visual: `C:\Users\nmein\.codex\generated_images\01a097f7-f6d6-7610-b5e5-43c9af75cefe\exec-c0c43b6a-6099-4c60-84c1-737d4544f726.png`
- Browser evidence: `artifacts/captain-lineup-opponent-reveal-390.png`, `artifacts/captain-lineup-opponent-reveal-active-390.png`, and `artifacts/captain-lineup-opponent-reveal-360.png`
- Live state: Aggressive Tri-Level scenario selected, projected opponent courts expanded, resilient lineup applied.

## Outcome

No actionable P0, P1, or P2 visual, interaction, responsive, or accessibility issues remain.

- **See their projected courts** reveals opponent pairs and calculated line ratings without adding permanent density to the decision card.
- Scenario assignments are compared court by court with Likely; changed courts receive a visible **Moved** label.
- When eligibility prevents a legal rearrangement, Captain explains that directly rather than implying unseen movement.
- Low-confidence scenario odds render as a 20-point estimated range around the modeled point; medium confidence uses a 12-point range and high confidence retains the point estimate.
- After **Build for all 3**, the control changes in place to **Resilient lineup active**, closing the previous no-visible-feedback gap.

## Responsive and accessibility evidence

- At 390 px, the complete three-court reveal, explanatory copy, range, and resilient action fit in one readable card.
- At 360 px, long doubles pair names wrap within their own column and document `scrollWidth` equals `clientWidth` at 345 px.
- The reveal summary measures 46 px high, the active build state uses text plus a status icon, and moved state never relies on color alone.

## Verification

- Focused lint: passed.
- Focused tests: 2 files, 19 tests passed.
- Typecheck: passed.
- Full test suite: 499 files, 2,383 tests passed.
- Production build: passed; 245 routes generated.
- Diff whitespace check: passed.

final result: passed

---

# Captain pair chemistry QA

- Source visual truth: `C:\Users\nmein\.codex\generated_images\01a097f7-f6d6-7610-b5e5-43c9af75cefe\exec-c0c43b6a-6099-4c60-84c1-737d4544f726.png`
- Implementation evidence: `artifacts/captain-lineup-pair-cards-390.png`, `artifacts/captain-lineup-pair-detail-390.png`, `artifacts/captain-lineup-pair-swap-390.png`, and `artifacts/captain-lineup-pair-cards-360.png`
- Source pixels: 853 × 1844. Implementation captures: 375 × 812 at a 390 × 844 CSS viewport and 345 × 767 at a 360 × 800 CSS viewport. Browser density was 1; the 15 px difference is the persistent browser scrollbar gutter, not content scaling.
- State: signed-in Captain, Tri-Level lineup loaded against Gontarz, opponent roster available, all three doubles courts filled, narrow phone layout.

## Findings

No actionable P0, P1, or P2 differences remain for this extension.

- Fonts and typography: the partnership label, three-stat hierarchy, and supporting-evidence disclosure use the existing TenAceIQ weights, sizes, and compact mobile line height. Long pair names and evidence text wrap without clipping.
- Spacing and layout rhythm: the chemistry signal nests under individual player evidence, while the detail card follows the source sheet hierarchy and preserves 44 px partner tabs and close control. The 360 px capture has no horizontal overflow (`scrollWidth` 345 px and rendered body width 345 px).
- Colors and visual tokens: the card uses the established navy surfaces, blue supporting-evidence label, and lime partnership accent with sufficient contrast; record status is never communicated by color alone.
- Image and icon fidelity: no new raster asset was needed. The partnership and swap controls use the existing Phosphor icon family; supplied TenAceIQ artwork remains untouched.
- Copy and content: “New pairing” and “no shared starts” avoid manufactured certainty. The sheet explicitly says shared starts do not change the rating-driven percentage yet.

## Full-view comparison evidence

The 390 px and 360 px court-list captures preserve the selected source’s scan order: match path, opponent scenario, lineup rows, player evidence, and probability. Partnership history adds one compact line per doubles court without displacing the probability or lock actions. The narrow capture keeps the full court action row visible and wraps only secondary evidence.

## Focused region comparison evidence

The 390 px partnership sheet was compared directly with the source’s expanded player lens. The implementation retains the same bottom-sheet pattern, clear close affordance, player tabs, history charts, and match read, while adding a compact partnership scorecard above individual history. The swap-sheet capture confirms pair history is also visible in the decision explanation.

## Interaction and accessibility checks

- Opened a doubles court and verified partnership starts, decided record, win rate, score tendency, and the supporting-only disclosure.
- Switched into the swap simulator, opened “Why the odds moved,” and verified the candidate’s history with the partner who remains.
- Verified dialog focus entry, Escape/close controls from the existing sheet behavior, readable accessible names, and no browser console errors.

## Comparison history

- Initial pass: no P0/P1/P2 issue found. At 360 px the pair signal wraps to two lines, which is acceptable and keeps complete evidence visible without overflow.
- No visual fix iteration was required.

## Verification

- Focused lint: passed.
- Focused tests: 2 files, 9 tests passed.
- Typecheck: passed.
- Full test suite: 499 files, 2,385 tests passed.
- Production build: passed; 245 routes generated.
- Diff whitespace check: passed (line-ending warnings only).

final result: passed

---

# Captain roster Pair Matrix QA

- Source visual truth: `C:\Users\nmein\.codex\generated_images\01a097f7-f6d6-7610-b5e5-43c9af75cefe\exec-c0c43b6a-6099-4c60-84c1-737d4544f726.png`
- Implementation evidence: `artifacts/captain-lineup-pair-matrix-final-390.png` and `artifacts/captain-lineup-pair-matrix-360.png`
- Source pixels: 853 × 1844. Implementation captures: 375 × 812 at a 390 × 844 CSS viewport and 345 × 767 at a 360 × 800 CSS viewport. Browser density was 1; the 15 px width difference is the persistent browser scrollbar gutter.
- State: signed-in Captain, USTA Tri-Level matchup against Gontarz, opponent roster loaded, six-player lineup filled and confirmed, Pair Matrix expanded on the 3.5 court.

## Findings

No actionable P0, P1, or P2 issues remain.

- Fonts and typography: ranking numbers, pair names, probability, evidence, and button labels retain the selected source’s compact high-contrast hierarchy. Long names wrap without clipping at 360 px.
- Spacing and layout rhythm: the matrix is collapsed by default below the court list, uses three 44 px court tabs, and presents each pair as a consistent scannable card. Expanded density is intentional because the captain explicitly requested every available pair.
- Colors and visual tokens: current pairs use the established lime success treatment; ranking and supporting information use the existing blue and muted tokens. Status is repeated in text and icons.
- Image and icon fidelity: no raster imagery was needed. The matrix uses the existing Phosphor grid and status icons and does not alter supplied TenAceIQ brand assets.
- Copy and content: “Projected odds rank the list” explains the sort order, while “history … is not weighted yet” prevents shared starts from being mistaken for modeled probability.

## Full-view comparison evidence

The 390 px capture preserves the source’s navy/lime decision language and inserts the Pair Matrix after the captain’s court rows, before Auto Builder. The collapsed header keeps the ordinary lineup flow compact; the expanded state provides a single continuous decision path rather than a new route.

## Focused region comparison evidence

The expanded 390 px and 360 px captures show rank, names, pair rating, availability, court probability, shared record, winning-set tendency, and the place/unlock action together. At 360 px, document `scrollWidth` and rendered body width both measured 345 px, with no horizontal overflow.

## Interaction and accessibility checks

- Switched between 3.5, 4.0, and 4.5 tabs and verified selected tab state and court-specific ranking updates.
- Unlocked a confirmed player from inside a blocked recommendation, placed Joel Pottebaum + Diego Mateluna at 4.0, verified the live applied status and recalculated current pair, then restored Sam Edwards + Joel Pottebaum and Sam’s lock.
- Verified current-pair state, actionable lock blockers, 44 px controls, responsive wrapping, and zero browser console warnings or errors.

## Comparison history

- Initial P2: locked recommendation controls read “Unlock Nick” or “Unlock Miles” but were disabled, creating a false affordance.
- Fix: each lock blocker now performs the stated unlock action in place; the same control becomes “Place on [court]” after the lock clears.
- Post-fix evidence: `artifacts/captain-lineup-pair-matrix-final-390.png`; browser interaction confirmed the unlock-to-place transition with no console errors.

## Verification

- Focused lint: passed.
- Focused tests: 2 files, 10 tests passed.
- Typecheck: passed.
- Full test suite: 499 files, 2,386 tests passed.
- Production build: passed; 245 routes generated.
- Diff whitespace check: passed (line-ending warnings only).

final result: passed
