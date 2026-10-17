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

# Design QA — My Lab zero-cost Player insight

## Visual truth

- Source surface: `.codex-audit/mylab-ai-audit-2026-09-28/01-scoreboard-first.png`
- Verification route: `http://localhost:3000/mylab`
- Verification viewport: 375 × 812 CSS pixels.
- Required state: authenticated Player member with connected rating and recent results.

## Comparison evidence

- Typography and hierarchy: the large TIQ scoreboard remains the first read; the new member conclusion is the next compact card.
- Layout and spacing: the first view retains the scoreboard, insight, and next action sequence. The expanded evidence card uses the existing analytics panel instead of adding another dashboard.
- Color and components: the new read reuses the established midnight navy, lime decision state, blue evidence accents, existing iconography, and existing card radii.
- Copy and data: Player members see a conclusion, supporting evidence, and a two-match next test. The visible 4.42 → 4.41 comparison and explanatory −0.01 movement now use the same baseline.

## Interaction and runtime checks

- Tapping the compact TenAce read opens `Why your number moved`.
- The expanded read shows evidence chips and a next test before the supporting analytics rows.
- Iteration 2 looks beneath the blended record: the verified 4-4 state now surfaces the two newest wins while explaining that TIQ remains nearly flat.
- The paid read closes the loop with a pressure test and a `Compare after` baseline for the next two results.
- Same-page analytics actions use native anchors, eliminating the development-time RSC navigation fallback found during interaction QA.
- Anonymous/free state does not receive a paid-member read.
- Document width measured 360 px inside the 375 px viewport, with no horizontal overflow.
- Browser console errors after the final interaction pass: none.
- Focused ESLint: passed.
- Typecheck: passed.
- Focused tests: 3 files, 27 tests passed.

final result: passed

---

# Design QA — My Lab mobile formatting and cycle copy

## Visual truth

- User-reported mobile capture: `C:\Users\nmein\.codex\codex-remote-attachments\01a0e921-d80c-7cd3-8136-5738a1f77d37\3136EC51-ECE8-4D95-B61B-6B4DC2C079A2\1-Pasted-Image-1.jpg`
- Browser-rendered implementation: `C:\Users\nmein\tennis-data\.codex-audit\mylab-scoreboard-2026-09-28\implementation-mobile-copy-format-fix.png`
- Focused cycle evidence: `C:\Users\nmein\tennis-data\.codex-audit\mylab-scoreboard-2026-09-28\implementation-mobile-cycle-copy-fix.png`
- Combined comparison: `C:\Users\nmein\tennis-data\.codex-audit\mylab-scoreboard-2026-09-28\comparison-mobile-format-copy-fix.png`
- Source dimensions: 591 × 1280 pixels; browser chrome is present in the capture.
- Implementation capture: 360 × 780 pixels from a 375 × 812 CSS viewport override in the Codex in-app browser.
- State note: the user capture shows the unlinked-player empty state while the authenticated local browser shows a connected 4.41 player. Comparison is therefore limited to shared component structure, responsive text behavior, and copy hierarchy rather than data parity.

## Findings and fixes

- P1 — The empty-state trend and priority signal clipped at phone width. Fixed by allowing the trend to wrap, changing the empty label to `No trend yet`, allowing the priority title to use two lines, and moving `See why` into the flexible copy column.
- P1 — `Stand → Understand → Act → Reflect` required interpretation. Fixed with direct player language: `Where I am → What changed → Next move → How it went`.
- Post-fix evidence: the scoreboard and priority card each report matching rendered and scroll widths, document width and scroll width both measure 360 px, and no browser console errors were recorded.

## Required fidelity surfaces

- Typography: the existing TenAceIQ font hierarchy and weights are preserved; previously truncated text now wraps within its card.
- Spacing and layout: the scoreboard remains the first dominant element, the priority signal keeps a compact three-column structure, and the four-step cycle fits without horizontal overflow.
- Colors and tokens: existing navy, blue, white, and lime product tokens are unchanged.
- Image and icon quality: existing approved product icons are retained; no supplied brand artwork was changed.
- Copy: the empty state and cycle now explain the player journey without shorthand.

## Verification

- My Lab focused tests: 14 passed.
- Targeted ESLint: passed.
- TypeScript: passed.
- Browser console errors: none.
- Horizontal overflow: none.

final result: passed

---

# Design QA — My Lab ultimate scoreboard

## Visual truth and capture

- Source visual truth: `C:\Users\nmein\.codex\generated_images\01a0e921-d80c-7cd3-8136-5738a1f77d37\exec-684a4be5-0875-48af-8583-e932eccc366c.png`
- Browser-rendered implementation: `C:\Users\nmein\tennis-data\.codex-audit\mylab-scoreboard-2026-09-28\implementation-mobile-first-five-seconds-final.png`
- Full page evidence: `C:\Users\nmein\tennis-data\.codex-audit\mylab-scoreboard-2026-09-28\implementation-mobile-390x844-full.png`
- Focused analytics evidence: `C:\Users\nmein\tennis-data\.codex-audit\mylab-scoreboard-2026-09-28\implementation-mobile-first-five-seconds-analytics.png`
- Combined comparison: `C:\Users\nmein\tennis-data\.codex-audit\mylab-scoreboard-2026-09-28\comparison-mobile-first-five-seconds-final.png`
- Browser viewport: 390 × 844 CSS pixels at 1×; Chromium content width is 375 pixels and the My Lab surface is 351 × 1243 CSS pixels.
- Source pixels: 853 × 1844. Implementation component pixels: 351 × 1243. Both were normalized to 400 pixels wide in the combined comparison.
- First-five-seconds comparison normalization: the 852 × 1877 source was top-aligned and cover-normalized to 390 × 844 beside the 390 × 844 implementation at 1× density.
- State: signed-in linked player Nathan; TIQ 4.41, prior checkpoint 4.42, recent record 4–4, 50% win rate, high confidence, no active focus or saved Level Up proof, next connected match in six days.

## Full-view and focused comparison evidence

The side-by-side comparison confirms the selected scoreboard-first hierarchy: dominant TIQ standing, trend meaning, recent record/win-rate/confidence evidence, what-was → what-is narrative, improvement cycle, high-contrast next action, latest-work reflection, contextual next match, and persistent phone shortcuts.

Focused inspection confirmed the 4.41 score remains the first dominant product object at the actual 351-pixel content width. The real-data implementation is intentionally taller than the generated concept because it preserves readable match location, reflection copy, and 44-pixel-or-larger actions rather than compressing live content into concept-only rows.

## Fidelity surfaces

- Fonts and typography: the production display stack preserves the source's heavy athletic score, uppercase blue metadata, compact evidence labels, and readable action copy. Long real team names are clamped rather than overflowing.
- Spacing and layout rhythm: navy panels, restrained separators, rounded surfaces, and the lime action maintain the reference rhythm. The opening order is unchanged even when data is incomplete.
- Colors and visual tokens: the implementation uses the established TenAceIQ navy, electric green, blue, white, and muted evidence colors with strong contrast.
- Image and icon fidelity: the shared shell uses approved brand assets; the command surface uses the existing TenAceIQ feature icon plus direct Phosphor icon modules. No logo artwork, fake player imagery, handcrafted SVG, emoji, or CSS illustration was introduced.
- Copy and content: all visible standing, record, trend, focus, proof, reflection, and match values come from connected My Lab data. Empty states remain honest and action-oriented.

## Findings and comparison history

No actionable P0, P1, or P2 findings remain.

1. Earlier P2: the rating delta collapsed into a vertical word stack beside the large score at the actual content width.
   Fix: changed the score composition to a two-column/two-row layout and reserved a readable right-side evidence lane.
   Post-fix evidence: the final component capture shows `-0.01 recently` and `From 4.42` on readable lines beside 4.41.
2. Earlier P2: `Understand` wrapped inside the flywheel and weakened the cycle.
   Fix: tightened rail spacing and label optical size while keeping every stage and arrow visible.
   Post-fix evidence: Stand → Understand → Act → Reflect reads as one continuous phone-width rail.
3. Earlier P1: scoreboard and next-action fragment links targeted content inside a closed `details` workspace.
   Fix: each flywheel stage now lands on a visible mobile target: `#mobile-scoreboard`, `#player-insights`, `#next-action`, or `#latest-reflection`. Internal setup actions use the valid `#player-workshop` fallback and open that disclosure before navigation.
   Post-fix evidence: browser interaction confirmed all four stages resolve to visible content at 390 × 844.
4. Earlier P2: the what-was → what-is card promised analytics but did not expose a phone-native insight surface.
   Fix: added a compact connected-data insight panel for direction, form, confidence, focus, and the rating narrative immediately beneath the story.
   Post-fix evidence: the final implementation capture shows the analytics panel directly below the first-view scoreboard and comparison card.
5. Follow-up refinement: the first analytics panel surfaced values but did not fully explain the decision behind them.
   Fix: expanded Understand into a compact evidence-to-action readout covering rating direction, recent form, signal quality, recommended focus, and a direct handoff to the next action.
   Post-fix evidence: `.codex-audit/mylab-scoreboard-2026-09-28/implementation-mobile-analytics-final.png`; the `Use this read` control resolves to the visible `#next-action` card.
6. Follow-up refinement: Reflect landed on a summary but did not let the player close the loop from the phone.
   Fix: added a three-state outcome check plus two short prompts for what worked and what changes next. The reflection remains device-safe and does not overwrite synced Level Up proof.
   Post-fix evidence: `.codex-audit/mylab-scoreboard-2026-09-28/implementation-mobile-reflection-final.png`; outcome selection, both labeled inputs, enabled save state, and draft reset on reload were verified at 390 × 844.
7. Follow-up refinement: proof, results, reflection, and the next action existed as separate cards without one persistent causal read.
   Fix: added Cycle Memory, a chronological proof → result → lesson → next move ledger. It uses connected Level Up proof, the latest match result, the saved phone reflection, and the existing recommended action; absent evidence is labeled honestly.
   Post-fix evidence: `.codex-audit/mylab-scoreboard-2026-09-28/implementation-mobile-cycle-memory-final.png`; the next-move control returns to the visible `#next-action` card.
8. Follow-up refinement: a single device-only reflection could not follow the player across devices or preserve multiple completed loops.
   Fix: added authenticated reflection history with per-player row security, local-first fallback, editable saved loops, a new-reflection action, and a compact Past loops library beneath Cycle Memory. The device cache accepts the earlier one-record format and upgrades it without discarding the player’s note.
   Post-fix evidence: the 390 × 844 browser pass opened the complete reflection form above Cycle Memory, confirmed the empty-history state, measured 375 px document and content widths with no horizontal overflow, and found no browser console errors. Migration `20260928000200` is applied; the authenticated reflection-history endpoint returns 200 while the device fallback remains available offline.
9. Follow-up refinement: saved loops existed, but My Lab did not yet turn their repeated outcomes and language into a concise player read.
   Fix: added an evidence-bound Pattern Read across the latest eight reflections. It calculates held-up rate and direction, surfaces repeated tennis themes only after they recur, and withholds the panel until two loops exist.
   Verification state: an isolated local-only two-loop fixture rendered the 50% held-up score, Strengthening direction, Second Serve working theme, and Margin adjustment theme at 390 × 844 with matching 390 px client and document widths, no horizontal overflow, and no console errors. The final capture is `.codex-audit/mylab-scoreboard-2026-09-28/implementation-mobile-pattern-read-final.png`. The fixture ran in a disposable browser profile and did not write test data to the player account; the two earlier `qa-*` device entries were also removed before the production-only code path was restored.
10. Follow-up refinement: the phone opening still made the player process multiple analytical cards before reaching the recommended action.
    Fix: compressed the authenticated first view into one decision sequence: rating and movement, one clearest signal, and the full next action. Moved the what-was → what-is story and three supporting signals into an on-demand analytics disclosure without removing any insight.
    Post-fix evidence: `.codex-audit/mylab-scoreboard-2026-09-28/comparison-mobile-first-five-seconds-final.png` confirms the same scoreboard-first hierarchy as the selected direction while reducing the path to action. In the authenticated in-app state, the score occupies y=336–553, the clearest signal y=563–634, and the complete next action y=644–810. In the isolated browser capture, the corresponding stack ends at y=800. Client and document widths match with no horizontal overflow, the analytics disclosure expands and closes cleanly, and browser console errors are zero.

## Primary interactions and runtime checks

- Stand, Understand, Act, and Reflect each navigate to a visible phone-native stage in the flywheel.
- `Use this read` carries the player from the analytics interpretation to the next recommended action without leaving My Lab.
- Reflect opens the inline check-in, exposes Off/Mixed/Held up as pressed states, and enables save only after an outcome plus a useful note is present.
- Signed-in reflections sync through the player-authenticated API after the new migration is applied; offline or failed syncs remain available on the current phone.
- Returning players can start a new loop or reopen one of the three most recent past loops without leaving the mobile command center.
- Pattern Read uses the latest eight loops, requires at least two before rendering, and requires a tennis theme to appear twice before calling it recurrent.
- Cycle Memory renders all four chronological stages and closes the loop back to the next action.
- The primary action and Train shortcut open the deeper workspace when their configured action depends on an internal My Lab editor.
- Scoreboard, analytic story, latest reflection, match plan, Today, Train, Matchup, and Profile expose semantic links.
- Browser console errors: none. One development-only Fast Refresh full-reload warning appeared during editing and did not recur as an application error.
- Focused ESLint: passed.
- Focused My Lab suite: 14 tests passed.
- Full TypeScript verification: passed.

## Follow-up polish

- P3: a future analytics pass can replace the compact trend icon with a data-rendered sparkline once a shared chart primitive is approved.
- P3: verified shot-pattern analytics can enrich the what-was → what-is story when point-level evidence is available; the current implementation correctly limits the story to connected rating and result evidence.

final result: passed

---

# Design QA — Home plan lanes refinement

## Visual truth and capture

- Source visual truth: `C:\Users\nmein\.codex\generated_images\01a0dffb-1b8a-7212-a5e7-f04542c4a5a3\exec-c262affd-315c-4e2c-a68d-9ab78f12eea1.png`
- Browser-rendered implementation: `C:\Users\nmein\tennis-data\artifacts\home-plan-lanes-qa\implementation-mobile-viewport-refined.png`
- Deployed implementation: `https://tennis-data-6vab4q5dq-tennis-data.vercel.app/#home-plan-lanes-title`
- Viewport and state: 390 × 844 CSS pixels, dark theme, Lead expanded, Captain selected.
- Density normalization: source 853 × 1844 pixels (~2.19× density); implementation 390 × 844 pixels at device-pixel ratio 1. The source was visually normalized to the implementation viewport before judging proportions.

## Full-view and focused comparison

- Full-view: the implementation retains the source's vertical Court Lane Map, navy/blue frame, lime Lead state, two-option role switch, prominent Captain CTA, and compact mobile hierarchy. The production header and surrounding homepage content remain intentionally outside the recreated component.
- Focused plan panel: the two strongest benefits now fit above the CTA at 390 pixels wide, bringing the primary action higher without weakening the selected-plan hierarchy.
- Focused anchor state: the fragment-targeted heading lands at approximately 102 CSS pixels from the viewport top, clearing the sticky navigation instead of touching the phone edge.

## Fidelity surfaces

- Fonts and typography: display weight, compact uppercase metadata, price hierarchy, wrapping, and small-label optical weight remain consistent with the source direction and production font stack.
- Spacing and layout rhythm: mobile section height is approximately 828 CSS pixels, down from approximately 870; the tighter plan panel preserves touch-target sizes and improves scan speed.
- Colors and visual tokens: midnight navy, restrained blue outlines, electric-lime active state, and text contrast remain consistent with the selected direction.
- Image quality and assets: approved TenAceIQ player/court assets and the existing `TiqFeatureIcon` system remain sharp and correctly masked; no brand artwork was redrawn.
- Copy and content: plan names, pricing, audience text, and benefits still come from centralized pricing content. Mobile intentionally shows the two strongest benefits while larger screens retain all three.

## Findings and comparison history

- No actionable P0/P1/P2 findings remain.
- Prior P3: fragment navigation placed the heading too close to the phone edge. Fixed with a 112-pixel heading scroll margin; post-fix evidence shows a ~102-pixel rendered top offset after sticky-header layout.
- Prior P3: the active plan panel was denser than necessary. Fixed with tighter mobile rhythm and two visible benefit rows; post-fix component height is approximately 828 CSS pixels.
- Prior P3: lane and role controls needed clearer touch feedback. Fixed with pressed-state scaling and subtle hover/transition feedback, with reduced-motion handling preserved.

## Runtime verification

- Organize opened and Club updated the panel to `$99/month`.
- Lead reopened and restored Captain at `$4.99/month`.
- Browser console errors: none.
- Targeted ESLint: passed.
- Local production build: passed (246 pages).
- Vercel preview build: READY (245 pages).

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

---

# Design QA — Home plan lanes

## Visual truth

- Selected source mock: `C:\Users\nmein\.codex\generated_images\01a0dffb-1b8a-7212-a5e7-f04542c4a5a3\exec-c262affd-315c-4e2c-a68d-9ab78f12eea1.png`
- Final implementation capture: `C:\Users\nmein\tennis-data\artifacts\home-plan-lanes-qa\implementation-mobile-section-final.png`
- Production browser check: `http://127.0.0.1:3000/#home-plan-lanes-title`
- Reference dimensions: 853 × 1844 pixels.
- Verification viewport: 390 × 844 CSS pixels at device-pixel ratio 1.
- Reference normalization: the source is approximately 2.19× the verification viewport density. The final component measures 351 × 870 CSS pixels inside the 390-pixel viewport.
- Required state: Lead lane expanded with Captain selected.

## Comparison evidence

The source and final implementation were inspected together at full-view and focused component scale.

- Typography: preserves the heavy display heading, compact uppercase labels, clear price hierarchy, and high-contrast body copy. The production site retains its approved font stack.
- Spacing and layout: preserves the vertical lane map, nested selected plan panel, large thumb-friendly role tabs, and single-column mobile rhythm.
- Color: preserves the midnight navy field, electric-lime active state and CTA, restrained blue outlines, and white/gray text hierarchy.
- Imagery and iconography: uses approved existing TenAceIQ court and player imagery plus the existing `TiqFeatureIcon` system. No logo or brand artwork was redrawn or recolored.
- Copy: keeps the selected concept's short tennis-specific framing while sourcing plan names, prices, descriptions, and benefits from the centralized pricing model.

## Iteration history

### Iteration 1

- Severity: P2
- Finding: the first mobile pass measured 366 × 1005 CSS pixels, which made the section materially taller and slower to scan than the normalized reference.
- Fix: tightened the mobile intro, lane headers, role tabs, detail panel, benefit spacing, and Full-Court row while retaining 44-pixel-or-larger primary tap targets.

### Iteration 2

- Result: the final component measures 351 × 870 CSS pixels, approximately 3% taller than the normalized source treatment.
- Remaining P0/P1/P2 issues: none.
- P3 note: player artwork is intentionally subtler than the generated mock so it does not compete with plan selection. Collapsed lanes intentionally omit secondary role buttons until expanded.

## Interaction and runtime checks

- Play opens and defaults to Explore.
- Player updates the detail panel with centralized plan content.
- Organize opens and exposes League and Club.
- Club updates price, description, benefits, and CTA.
- Lead returns to Captain as the default active role.
- Production bundle rendered at 390 × 844 with `Pick your court` and `Captain` present.
- Browser console errors: none.
- Targeted ESLint: passed.
- Production build: passed (246 pages).

final result: passed

---

# Pumpkin Playoffs — Night Session design QA (2026-10-07)

This section preserves the earlier QA reports above and covers the selected tournament/event redesign only.

## Visual truth and evidence

- Selected source: `C:/Users/nmein/.codex/generated_images/01a11818-aa69-7842-a52f-d66e97d64d35/exec-369c68d1-008a-4a6b-89b7-f0ff693a0825.png` (the first displayed concept).
- Source pixels: 1487 × 1058.
- Interactive implementation: `http://127.0.0.1:3221/tournaments/pumpkin-playoffs-2026`; this harness imports the actual production `TournamentEventPanel` and supplies the announced event facts, with zero entrants.
- Desktop viewport requested: 1488 × 1056 CSS pixels. Browser screenshots measure 1473 pixels wide because the capture includes the content area beside the scrollbar. Density: 1×.
- Browser capture: `.codex-audit/night-session-preview/desktop-final.png` (1473 × 1174, including the separate preview toolbar).
- Feature-only capture: `.codex-audit/night-session-preview/desktop-feature-final.png` (1473 × 1106; full event content, without the test harness toolbar).
- Combined full-view comparison: `.codex-audit/night-session-preview/comparison-final.png`. Both panels are proportionally normalized to 744 pixels wide; no stretching.
- Combined title/typography comparison: `.codex-audit/night-session-preview/comparison-title.png`.
- Phone viewport: 390 × 844; `.codex-audit/night-session-preview/mobile-final-390x844.png` captures the first fold, including the reachable signup action.
- Director view: `.codex-audit/night-session-preview/director-final.png`.
- Tested state: Pumpkin Playoffs, October 17, 2026; Men's 4.0 and 4.5 doubles; $40/player and $80/team; direct email signup; private draft; no invented entrants, matches, or courts.

## Comparison history

### Initial comparison — blocked

- [P2] The implementation was materially taller than the selected design. The hero, extra draw link, separate announcement row, and preview toolbar increased vertical density. Evidence: `comparison-initial.png` and `desktop-initial.png` (1473 × 1260).
- [P2] Unselected native radio controls rendered as bright white discs against the dark surface. They competed with the primary action.
- [P2] Phone signup required scrolling through all event facts and divisions before reaching the main action.

### Revised comparison — passed

- Tightened the hero typography and vertical spacing; suppressed draw links until at least two entrants exist; moved the full announcement into the event-details disclosure; kept the preview toolbar outside the production component.
- Applied native dark control styling rather than drawing replacement radio assets.
- On phones, removed the duplicated start-time tile and placed price and deadline side by side. Added a bottom signup action with the selected division and price, safe-area padding, and enough page padding to keep final content reachable.
- Re-captured and compared the actual component to the source in `comparison-final.png` and `comparison-title.png`.
- No remaining actionable P0/P1/P2 findings in the implemented frontend states.

## Required fidelity surfaces

- Typography: strong two-line headline, ivory first line and pumpkin accent second line; readable product sans for body copy; restored the signup heading and summary to the source hierarchy. Small differences in glyph shapes from the system font fallback are P3.
- Spacing/layout: open page surface, photographic hero, three desktop facts, division rows on one shared surface, and one restrained signup panel. The existing product's Events breadcrumb replaces the mock's invented global navigation; the real product retains its own shell. The complete rules disclosure adds a small intentional amount of height.
- Colors/tokens: navy/evergreen base, warm ivory, pumpkin-orange accent, and the approved green action color. No TenAceIQ brand artwork was redrawn, recolored, or replaced.
- Image quality: generated a separate photographic hero rather than rasterizing the UI. Natural dark court on the left, pumpkins/balls/racket on the right, correct crop and proportions. Optimized WebP is 147,820 bytes. The missing generic fence lettering is an acceptable artistic difference; it is not event information.
- Copy/content: date, start time, expected finish, deadline, fees, director, venue/address, format, refreshments, outside-alcohol rule, sponsors, and sanctioning status match the supplied announcement. No fake confirmed draws or availability metrics.

## Interaction and accessibility checks

- Selecting 4.5 changes the signup summary and both email links to 4.5.
- Email subject and body contain the selected division, blank player/partner fields, and the correct recipient; testing inspected the link without sending email.
- Native radio keyboard ArrowDown changes the selection and the phone signup link.
- Director division buttons trigger the supplied selection callback. The real workspace now scrolls to the event/division editor after that selection.
- Announcement disclosure is operable; ordinary app links retain their existing route targets.
- Hero art is decorative with empty alt text. Icons come from the existing Phosphor library. No emoji or fabricated artwork shapes.
- Visible focus styles, native labeled controls, minimum practical tap targets, and reduced-motion styling are present. This is not a claim of full WCAG certification.
- No horizontal overflow at desktop or phone width. Browser warnings/errors: none in the tested frontend.
- Unit tests cover selected-division email construction, timezone-aware inclusive deadlines, invalid event data, division isolation, shared detail propagation, and API refusal of parent-event or closed registrations.

## Asset provenance

- Built-in ImageGen created the photograph. Prompt: photographic recreation of the selected night-session hero, wide 2.4:1 frame, naturally dark court across the left 55%, warm floodlights and autumn foliage, pumpkin, two tennis balls and black/orange racket on a wood bench across the right 45%; no typography, UI, logos, or emoji.
- Master: `public/media/tournaments/pumpkin-playoffs-night-session-v1.png` (1942 × 809).
- Production image: `public/media/tournaments/pumpkin-playoffs-night-session-v1.webp`.

## Limits and follow-up

- The live event migration and consolidation remain unapplied pending approval after automatic review rejected the persistent database/access-policy change. This QA pass verifies the frontend and local tests; live database persistence and public publishing are not claimed.
- One pre-existing `teams-experience-simplification` assertion fails in the full suite; the event tests pass.
- P3: exact typeface/glyph matching and physical fence lettering can be refined later without changing the working event flow.

final result: passed

## Pumpkin Playoffs release verification — October 7, 2026

PR #1500 merged to master as a4bb907ca2fd6b714da04bebc56e9c95b206f747. Vercel production deployment tennis-data-hjtt93f02-tennis-data.vercel.app is READY. Final local lint, typecheck, 673 test files / 3,540 tests, extension syntax check, and production build passed. Required GitHub Verify, TIQ Schema Audit, and Captain weekly continuity checks passed.

Both approved event migrations are applied and recorded. Anonymous users can read the new public metadata columns but cannot read the legacy private contacts column or the private Pumpkin Playoffs records. An authenticated organizer role can read the parent and both existing divisions. Transactional inheritance, results, ownership, deletion, and visibility checks passed.

Bounded live checks: /tournaments rendered the new events copy without console errors; 390px mobile had no horizontal overflow; the night-session WebP returned HTTP 200 and image/webp; the private Pumpkin Playoffs URL rendered its unavailable state without lookup errors. The five-minute production log scan returned zero errors, fatals, HTTP 500s, or warnings. Authenticated editing was verified through local tests and database policies; an authenticated production browser session was not available for an interactive editing check.

Release screenshot: .codex-audit/night-session-preview/live-tournament-hub.png. Pumpkin Playoffs remains a private draft. Final result: passed for release; organizer review/publication remains a separate action.

## Event organizer overview and shared court planning — October 7, 2026

Added division readiness, confirmed-team totals, schedule/result progress, and direct next actions, plus a shared court timeline with division, unassigned, and overlap filters. The inline editor supports date/time/court changes, explicit overlapping-slot saves, clearing assignments, and failed-save recovery. Planning warnings use a visible 30/45/60/90-minute estimate rather than a claimed match duration. Schedule-only persistence refreshes draw data and checks the last update version before saving.

Focused tests passed for real draw IDs, midnight overlaps, adjacent slots, completed matches, readiness transitions, invalid slots, rejected writes, refreshed schedules, removed matches, and result preservation. Full local lint, typecheck, 675 files / 3,550 tests, extension syntax check, and Next.js production build passed. Generated preview files are excluded from application checks; application source remains included.

Desktop and 390px phone checks passed for reassignment, failed-save input retention, clearing, filters, keyboard focus, and zero-entrant drafts. No horizontal overflow or console warnings/errors were observed in the isolated component preview. The actual production-bundle organizer route passed its logged-out access-gate smoke without console errors. An authenticated browser session was unavailable; a rollback-only authenticated database test verified allowed organizer writes and rejected stale versions. It exposed an existing trigger SELECT * permission bug, repaired by reading only already-authorized metadata; migration 20261007000300 is applied and recorded, with private contacts still restricted. Production event data was not changed.

Visual evidence: .codex-audit/night-session-preview/organizer-desktop.png and organizer-mobile-editor.png. Interactive preview: http://127.0.0.1:3225, with explicitly labeled sample teams and a switch for an empty draft. PR: https://github.com/TNM91/tennis-data/pull/1502. Final UI verification: passed; release checks pending at this entry.

Release completed: PR #1502 merged to master as a886c50a69580bb2eb5c57264014612c64a5daae. Production deployment tennis-data-mlq21b0ew-tennis-data.vercel.app is READY. Required Verify, TIQ Schema Audit, and Captain weekly continuity checks passed on the final commit. Bounded live checks passed for the organizer sign-in gate, zero console errors, no horizontal overflow at 390px, and the private Pumpkin Playoffs unavailable state. The five-minute production log scan returned zero errors, fatals, HTTP 500s, or warnings. Pumpkin Playoffs remains a private draft. Final release result: passed.

## Player event pass — approved database verification (2026-10-07)

Implemented player passes and organizer arrival confirmation in focused PR #1503. Full local release checks passed: lint, typecheck, 676 test files / 3,555 tests, extension syntax, production build. Desktop and 390px sample browser checks passed selection, pending/assigned courts, confirm/clear, refresh, and failed save/direct retry. Production bundle smoke confirmed logged-out access gates without console errors.

The user approved attendance storage, public status reads for published divisions, and tournament-manager writes. Applied migrations 20261007000400 and 20261007000500; explicitly revoked inherited table privileges. Rolled-back linked database fixtures proved public/private reads and manager/anonymous/unrelated-user write restrictions. No test fixtures remain. Readback confirmed all three Pumpkin Playoffs records remain private drafts with zero entrants. Authenticated production browser saves were not exercised. CI/release are pending; preserve this limitation in release reporting.

Player event pass release passed: PR #1503 merged to master at a64ddf52a04a12f9618dccb882fcde5e18e2ec52. GitHub Verify, TIQ Schema Audit, and Captain weekly continuity passed. The single Git production deployment tennis-data-1k1su99iq-tennis-data.vercel.app is READY and serves www.tenaceiq.com. Bounded live smoke confirmed the logged-out organizer access gate, 390px layout without horizontal overflow, and private Pumpkin Playoffs rejection, with no browser console errors. Five-minute deployment log scan returned no error/fatal/warning records. Authenticated production browser edits were not exercised; direct role-based database verification passed. Pumpkin Playoffs and both divisions remain private drafts with zero entrants.

## Group standings and championship release (2026-10-07)

Released PR #1504, merge e82e7a2d765e8ba95a128da53d39d2a47b746f20, via one master Git production deployment dpl_CrCA5rGeJFMpXhNUoDH5w41vCxRg (tennis-data-clp5sds2n-tennis-data.vercel.app). READY; www.tenaceiq.com alias explicitly confirmed on this deployment. Full local checks passed: lint, typecheck, 678 test files / 3,571 tests, extension syntax, and production build. Required Verify, TIQ Schema Audit, and Captain weekly continuity CI gates passed.

Real component sample-browser checks passed group qualification, ties, small-field bracket, empty draft, champion/earlier-score clear, organizer scorebook/setup callbacks, and player-pass champion/completed-run states on desktop and 390px phone, with no console errors or horizontal overflow. Direct role-based, rollback-only database verification passed organizer persistence, stale-version rejection, field/format lock, clear-then-edit, and unrelated-user rejection. Authenticated production browser edits were not exercised.

Migration 20261007000600 is applied and recorded. After deployment, the guarded operation configured the Pumpkin Playoffs root and both original division IDs to group_playoffs. Readback confirmed one root, its same two children, private draft status, and zero entrants. No participants, court assignments, or scores were added. Five-minute deployment log scan found no error/fatal/warning records; bounded live desktop/phone organizer access and private-event gates passed. Preview and screenshots use explicitly labeled sample teams.

## Event palette correction — 2026-10-08

- Event pass and championship standings now use the site's shared navy surfaces, borders, text colors, and lime highlights. Dark native selects and keyboard focus checked; pumpkin-orange trophy detail retained.
- Desktop and 390px sample-component previews reviewed with no horizontal overflow. Proof: `.codex-audit/night-session-preview/site-palette-pass-desktop.png` and corresponding standings/mobile captures.
- Lint, typecheck, 678 test files / 3,571 tests, extension syntax, and local production build passed. Logged-out production bundle organizer and private-event gates passed.
- PR #1505 merged as `0491d81fc6fac28a95bb3ef0ae22fd62005ca52c`; all required CI passed. Git production deployment `dpl_Gm8neYTtZ81LaJh2jtbZSb4X4VPH` READY on www.tenaceiq.com.
- Bounded live organizer/private-event gate smoke passed, 390px overflow false, browser console clean, five-minute deployment warning/error/fatal log scan empty. No authenticated event saves exercised for this CSS-only correction. Event visibility and data unchanged.
