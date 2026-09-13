# Platform mobile text audit — 2026-09-13

## Scope

Checked the primary public, Player, Captain, Coach, League Office, and admin routes at 320 × 844 and 390 × 844. The browser scan tested document overflow, clipped visible labels, and ordinary words rendered across multiple line boxes.

## Findings and fixes

- Shared mobile typography allowed ordinary labels to break at arbitrary characters. Buttons, links, labels, headings, and standard copy now preserve whole words.
- Player Discovery forced three quick filters into undersized columns at 320 px. The narrow layout now uses two columns.
- Team Hub forced three pulse cards into undersized columns. The narrow layout now uses two columns, with the final card spanning the row.
- Data Trust labels could shrink inside pills. Labels now keep their natural width while long values remain safely wrappable.
- League Office command labels inherited arbitrary word breaking. Normal word boundaries are now preserved.
- Pricing placed the Club Unlimited badge in the 48 px icon column and allowed accordion cues to shrink. The badge now spans the card and cues keep their natural width.

## Evidence

- [Player Discovery at 320 px](./platform-mobile-text-players-320-after.png)
- [Team Hub at 320 px](./platform-mobile-text-captain-320-after.png)
- [League Office at 320 px](./platform-mobile-text-league-320-after.png)
- [Pricing at 320 px](./platform-mobile-text-pricing-320-after.png)

## Result

The final automated scan reported zero horizontal document overflow, zero visible clipped labels, and zero ordinary mid-word breaks across the audited route set at both phone widths.
