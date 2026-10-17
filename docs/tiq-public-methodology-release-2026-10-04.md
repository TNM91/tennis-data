# Public TIQ methodology release — October 4, 2026

Public profiles and the methodology explain TIQ playing strength separately from published USTA levels. Internal outside-source estimates and comparisons do not appear in the public methodology. Internal ingestion and research records retain their provenance.

The public guide explains starting evidence, chronological game-share updates, doubles partners, half-point display bands, deciding match tiebreaks, excluded courts and limited evidence. It states that annual USTA movement predictions have not been validated.

Profiles label the selected TIQ value as playing strength and show the current-year selected-format rated-result count plus latest rated-result date. These stored results can include fallback estimates. They must not be described as network-only usable courts or a confidence percentage. The latest result is explicitly distinguished from the last import; public profiles currently lack a verified source-refresh timestamp.

Preview checks on Nathan Meinert confirmed 17 overall, eight singles and nine doubles rated results. The latest singles result is April 26, 2026; doubles is September 30, 2026. Existing membership restrictions on exact ratings remain in effect. Browser layout was checked and an evidence screenshot retained at artifacts/rating-evidence/public-tiq-profile-preview.jpg.

PR: https://github.com/TNM91/tennis-data/pull/1477. Focused profile/methodology checks passed. Two obsolete full-suite copy assertions were updated to reflect the approved labels and removal of outside-source public references. Final CI passed all 3,284 tests, lint, typecheck, production build, schema audit and captain continuity. PR 1477 merged as 90de8c5f9414a06e0692c4029cc3c3c92a572ae1. Production deployment dpl_6tJqMPSp8RV8PdUx3LJMJ4VEMBya is READY with www.tenaceiq.com assigned.
