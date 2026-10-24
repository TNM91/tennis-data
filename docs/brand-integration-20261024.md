# Approved brand integration — October 24, 2026

The website uses the supplied TenAceIQ full wordmarks, transparent TiQ marks, app icon, favicon, and device icons. Originals are preserved in `public/brand/approved/`; aliases are exact copies. The header uses the light full wordmark at 178px on phones and 200px on wider screens. Authentication pages, footers, loading states, compact marks, decorative watermarks, share/print surfaces, court net, social card, and nine tour posters/videos use the approved branding.

Court interaction geometry is unchanged. All nine refreshed videos retain their encoded audio streams and durations. No authentication, Supabase, payment, rating, league, database, dependency, or native-app changes are included. The release is based on production commit `37d79d357d5eb883887c24a851c34dfbc6b47f50`.

Validation:

- `npm run verify`: passed lint, type checking, 747 test files / 3,945 tests, extension check, and production build (300 static pages).
- Local production bundle: header checked at 320, 390, 768, and 1440px; contained artwork, loaded images, no horizontal overflow. Phone login reviewed visually.
- Seven favicon/Apple/PWA/wordmark aliases served byte-for-byte; manifest sizes 192 and 512; court, social card and teaser video returned HTTP 200.
- SEO/share readiness passed for 17 public and 16 private routes; share PNG 934,763 bytes.
- Prior visual review confirmed transparent edges and court pixels outside the net region; all nine video audio hashes and durations match originals.
- No authenticated member session was available for a manual signed-in browser smoke.
- Local verification used Node 24; required CI and Vercel use the configured Node 22 runtime.

Dependency installation reported existing advisories (root: 4 moderate, 11 high, 1 critical; native package: 3 moderate). Lockfiles are unchanged; dependency remediation should be assessed separately.

See `public/brand/docs/MANIFEST.txt` and `CODEX_IMPLEMENTATION_PROMPT.txt` for asset mappings and repeatable refresh commands. GitHub checks and the single Git-triggered production deployment must pass before release completion.
