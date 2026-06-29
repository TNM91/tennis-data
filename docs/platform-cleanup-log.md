# TenAceIQ Platform Cleanup Log

Use this log for storage, deployment, and repository cleanup decisions that should remain visible after the work is done.

## 2026-06-29 Repository and Deployment Cleanup

Result: complete

Backup:

- Created before deletion: `C:\Users\nmein\tennis-data\backups\tenaceiq-site-pre-cleanup-20260629-111143.zip`
- Moved out of the repo after production verification: `C:\Users\nmein\TenAceIQ Backups\tenaceiq-site-pre-cleanup-20260629-111143.zip`

Repository cleanup:

- Removed generated local artifacts, logs, screenshots, archived error dumps, the old `app.zip`, and the duplicate nested `tennis-data/` project folder.
- Removed unused public assets after reference checks, while keeping active TenAceIQ branding, PWA icons, social preview assets, and locked tactical `/tiq/` assets.
- Updated `.gitignore` and `.vercelignore` so local artifacts, agent files, backup folders, old dumps, and duplicate project folders do not return to Git or Vercel uploads.
- Ran `git gc`, reducing local `.git` storage from about 152 MB to about 103 MB.

Vercel cleanup:

- Promoted the verified cleanup deployment to production.
- Pruned older unaliased preview deployments with `vercel remove --safe`.
- Left production deployments and actively aliased branch/PR previews intact as rollback or review points.

Verification:

- `npm run verify` passed after normalizing one CSS snapshot-style test for Windows and Unix newline compatibility.
- Production smoke checks returned `200` for `/`, `/pricing`, `/mylab`, `/coach`, `/captain`, `/league-coordinator`, `/tactics`, `/manifest.webmanifest`, `/sitemap.xml`, and `/robots.txt`.
- Vercel production logs showed no recent runtime logs after deployment.

Pushed commits:

- `83e6eb63` Clean up unused local artifacts
- `467c9697` Preserve coach assignment route drafts
- `38c9c812` Remove unused public image
- `cf81ebed` Normalize proof trail CSS test newlines

Decision notes:

- Do not rewrite Git history unless GitHub repository size becomes an actual constraint. The remote repo was about 95 MB after cleanup, and history rewriting would add coordination risk.
- Do not remove `node_modules/` as routine cleanup. It is local-only, ignored, and useful for development; delete it only when local disk space matters.
- Treat remaining production deployments as rollback anchors unless Vercel retention or plan limits require a stricter policy.

## 2026-06-29 Follow-Up Capacity And Dependency Cleanup

Result: complete

Repository and deployment capacity:

- Excluded docs, tests, QA evidence, GitHub workflow files, Playwright config, and capture-extension tooling from Vercel uploads with `.vercelignore`. The promoted production build removed 305 ignored files from the build context.
- Removed unused `@react-three/drei`, `@react-three/fiber`, and `three` dependencies after confirming there were no source imports.
- Removed the duplicate `public/tiq/courts/tiq-court-master-v2.png` asset after consolidating all tactical court references onto `public/tiq/courts/tiq-court-master.png`.
- Removed three byte-for-byte duplicate QA evidence screenshots and updated the customer journey ledger to reference the kept proof files.

Dependency hardening:

- Updated production packages to `next@16.2.9`, `eslint-config-next@16.2.9`, and `@supabase/supabase-js@2.108.2`.
- Added a narrow npm override so Next uses patched `postcss@8.5.16`.
- Ran non-force `npm audit fix` for dev-only advisories; full `npm audit` now reports zero vulnerabilities.

Production verification:

- Promoted deployment `tennis-data-g6g2yhnpl-tennis-data.vercel.app` (`dpl_4wKr3kNEL6LTUv8NL2egbvvfJnqd`) to production.
- Production route smoke returned `200` for `/`, `/explore`, `/pricing`, `/mylab`, `/tactics`, and `/data-assist`.
- Vercel production logs showed no recent runtime logs after deployment.
- Deployed the final cleanup sync from commit `edae2d4d` to `tennis-data-e7q4iqr3v-tennis-data.vercel.app` (`dpl_G394YELu3QaUNFFYiK27PvgzsfAx`) and confirmed `www.tenaceiq.com` returned `200` for `/`, `/explore`, `/pricing`, `/mylab`, `/tactics`, `/data-assist`, and `/favicon.ico`.
- Pruned 35 unaliased Vercel Preview deployments with `vercel remove --safe --yes`; production rollback deployments and actively aliased previews were left intact.
- Confirmed production still returned `200` for `/`, `/explore`, `/pricing`, and `/favicon.ico` after the preview deployment prune.

Remaining launch blocker:

- Signed-in customer journey QA still needs real fixture credentials outside Git. Day 1 is blocked until `TENACEIQ_QA_COACH_EMAIL`, `TENACEIQ_QA_COACH_PASSWORD`, `TENACEIQ_QA_PLAYER_EMAIL`, and `TENACEIQ_QA_PLAYER_PASSWORD` are set in `.env.local` or the shell.
