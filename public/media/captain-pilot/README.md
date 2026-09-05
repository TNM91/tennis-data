# Captain pilot print flyer

`fall-2026-flyer.pdf` is the dedicated one-page US Letter print/download file.
The application links to it from `/captain-pilot/flyer`.

Offer copy comes from `lib/captain-pilot-flyer.ts`, which reads the current
three-month trial and renewal price from `lib/captain-pilot.ts`.
Do not edit the exported PDF or its JSON manifest by hand.

To regenerate, use Python with ReportLab installed:

```powershell
npx tsx -e "import { CAPTAIN_PILOT_FLYER } from './lib/captain-pilot-flyer'; console.log(JSON.stringify(CAPTAIN_PILOT_FLYER))" | python scripts/build-captain-pilot-pdf.py
```

Then run `npx vitest run lib/__tests__/captain-pilot-flyer.test.ts`, render the
PDF, and inspect it at normal size. Confirm one Letter page, readable terms,
working QR/link destination, and no clipping. The regression test compares the
export manifest to the shared copy so an offer change requires regeneration.

Only approved artwork from `public/brand/` is used. The PDF contains no member
or team data. Trial length remains three consecutive months from activation;
December 31, 2026 is the enrollment deadline, not a fixed trial end date.
