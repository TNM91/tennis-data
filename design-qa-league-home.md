# League Office landing — design QA

- Source visual truth: `C:\Users\nmein\.codex\generated_images\01a0ef62-ba47-7300-9a29-16d0a697cee3\exec-7a73edc9-a0fa-4b4c-aa1e-e472429cac2a.png`
- Browser-rendered implementation: `design-qa-implementation-mobile.png`
- Combined comparison: `design-qa-comparison-mobile.png`
- Viewport: 390 × 844 CSS px, Codex in-app browser, device scale factor 1
- Source pixels: 852 × 1878
- Implementation pixels: 390 × 844 (375 px content width plus browser scrollbar)
- Density normalization: implementation resized to 852 px wide for the combined comparison; source retained at native size
- State: mobile, dark theme, League Office preview state with locally available sample league data. The selected visual shows paid League state; dynamic action copy and plan status intentionally reflect the actual entitlement state.

## Findings

No actionable P0, P1, or P2 differences remain.

- Typography: the implementation preserves the reference hierarchy—a compact uppercase entitlement cue, a large two-line decision headline, strong task title, and smaller operational metadata. It uses the product’s existing font stack and optical weights instead of introducing a one-off display font.
- Spacing and layout: the shared TenAceIQ web header is intentionally retained. The generic shortcut rail was removed from League Office so the plan cue, active league, next decision, progress, and pulse now form one uninterrupted landing hierarchy. Mobile pulse rows were consolidated into one bordered group to match the source rhythm.
- Colors and tokens: the navy surface, lime primary action, blue metadata, quiet borders, and dark elevated cards map to existing TenAceIQ tokens. Contrast remains strong at mobile sizes.
- Image and icon fidelity: the implementation uses the approved TenAceIQ header artwork and the existing Phosphor-backed `TiqFeatureIcon` system. No source asset is replaced with an emoji, text glyph, handcrafted SVG, or placeholder image.
- Copy and content: the selected weekly-play language is represented dynamically. Paid League users see their plan, league, and next operational decision; preview users see truthful League preview and upgrade language rather than fabricated paid access.
- Responsiveness and behavior: no horizontal page overflow was found. Primary, directory, desk, pulse, and shortcut targets are real links. In locked preview state, coordinator-only anchors are replaced by the public league directory or League plan path.

## Full-view comparison evidence

`design-qa-comparison-mobile.png` places the selected source on the left and the browser capture on the right at a normalized width. Both show the same visual order: product header, entitlement and league context, decision headline, dominant task card, five-stage progress, and season pulse. The implementation’s shared web header and entitlement-aware preview copy are intentional product constraints, not visual drift.

## Focused-region comparison evidence

The decision card and progress region are legible in the full comparison and did not require a separate crop. The browser capture confirms matching card treatment, lime CTA dominance, icon scale, progress continuity, and the start of the consolidated pulse list at the same mobile breakpoint.

## Comparison history

### Iteration 1

- Finding [P2]: the generic platform shortcut rail consumed the first screen and weakened the dedicated League Office hierarchy.
- Fix: disabled the generic portal toolbar on the League Office landing route while retaining the shared TenAceIQ header and menu.
- Post-fix evidence: `design-qa-implementation-mobile.png` begins directly with the tier-aware League Office home below the shared header.

- Finding [P2]: separate mobile pulse cards created excess visual height and did not read as the compact operational list in the source.
- Fix: consolidated mobile pulse items into one bordered list with shared dividers and reduced shortcut density.
- Post-fix evidence: `design-qa-comparison-mobile.png` shows a continuous pulse group aligned with the source composition.

- Finding [P1]: the locked preview exposed coordinator-only anchor targets that were not rendered for an unauthenticated user.
- Fix: preview-state league context now opens the public league directory, and desk/pulse actions open the League plan; paid League state retains operational destinations.
- Post-fix evidence: browser inspection confirmed `/compete/leagues` for the directory and `/pricing#league` for locked operational actions.

## Interaction and console checks

- Confirmed League Office loaded at `/league-coordinator` and settled from loading to populated league context.
- Confirmed entitlement-aware directory and plan destinations in the locked preview state.
- Confirmed the public `/leagues-and-tournaments` page no longer includes Club in its League task grid and exposes a distinct “Run the whole club?” path.
- Checked the League Office browser console: no errors. One existing Supabase auth deprecation warning was observed and is unrelated to this change.

## Follow-up polish

- [P3] A future authenticated visual fixture could capture the exact “Roster review” paid League state without depending on a signed-in browser session.

final result: passed
