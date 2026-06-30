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

Launch QA status:

- Signed-in production QA is complete for Free, Player, Coach, Captain, League, Full-Court, and Admin coverage. Fixture credentials remain local-only in `.env.local` and are not committed.

## 2026-06-29 Launch Evidence And Local Git Capacity Cleanup

Result: complete

QA evidence capacity:

- Recompressed committed QA evidence PNGs with a lossless Sharp pass: 65 PNGs scanned, 59 optimized.
- Reduced `docs/qa-evidence` from about 69.66 MB to about 31.20 MB, saving about 38.46 MB while keeping existing filenames and ledger references stable.
- Spot-checked optimized desktop and mobile evidence images after recompression.

Deployment capacity:

- Confirmed `.vercelignore` already excludes docs and QA evidence, so the signed-off evidence archive is retained in Git without increasing Vercel build upload size.

Local repository maintenance:

- Ran `git gc` after image optimization. Loose objects dropped from 78.34 MiB to 0 bytes; local `.git` storage is about 218.81 MB after packing.
- No Git history rewrite was performed; the stable launch marker remains `launch-ready-2026-06-29`.

Verification:

- `npm run audit:artifacts` passed after generated local artifacts were removed.
- `npm run qa:launch` passed after the evidence optimization.

Related commits:

- `a47004e5` Optimize QA evidence images
- `3077b32e` Note optimized QA evidence size

## 2026-06-30 Follow-Up Vercel Preview Capacity Cleanup

Result: partial safe cleanup

Preview deployment capacity:

- Ran `npx vercel remove tennis-data --safe --yes --scope tennis-data` to prune unaliased Preview deployments while preserving production deployments and actively aliased branch previews.
- The command timed out after making progress, so the lingering `vercel remove tennis-data --safe --yes --scope tennis-data` Node processes were stopped manually.
- Confirmed at least one stale preview deployment from the recent housekeeping run, `tennis-data-2ulg7ug9r-tennis-data.vercel.app`, was removed; subsequent deployment listings exposed older retained production and rollback deployments.
- Left production deployments and branch-aliased previews intact.

Verification:

- `npx vercel inspect https://www.tenaceiq.com --scope tennis-data` reported production deployment `tennis-data-6w079qjdn-tennis-data.vercel.app` as `Ready`.
- `npx vercel logs https://www.tenaceiq.com --since 1h --level error --scope tennis-data` returned no logs for the checked window.

## 2026-06-30 Local Workspace Git And Artifact Cleanup

Result: complete

Local workspace cleanup:

- Removed generated `tsconfig.tsbuildinfo` after `npm run audit:artifacts` flagged it as a closeout artifact.
- Deleted three local branches already merged into `master`: `codex-design-polish-pass`, `codex/ci-master-branch-trigger`, and `codex/data-assist-foundation`.
- Pruned stale local `origin/...` remote-tracking refs that no longer exist on GitHub; remote-tracking refs dropped to 19.
- Ran `git gc`; loose Git object storage dropped to 0 bytes.

Dependency and runtime notes:

- `npm prune` completed with zero vulnerabilities. Four optional native support packages still appear as extraneous in `npm ls --depth=0`; prior prune passes do not remove them, so they are being left as npm-managed local dependency state rather than manually deleting package internals.
- Local shell Node is `v24.14.1`, while the repo, CI, and Vercel project are aligned on Node `22.x`. No local Node version manager (`nvm`, `fnm`, or `volta`) was found, so local runtime switching remains a workstation setup follow-up.

Verification:

- `npm run audit:artifacts` passed after removing `tsconfig.tsbuildinfo`.
- `npm run qa:launch` passed before the cleanup-log entry was committed.

## 2026-06-30 Targeted Vercel Preview Deployment Prune

Result: complete

Preview deployment capacity:

- Pruned 201 old Vercel Preview deployments with targeted `vercel remove <deployment-id> --safe --yes --scope tennis-data` batches.
- Removed stale merged-PR previews and old `master` previews after checking current open PR branches and preserving the newest `master` preview anchors.
- Kept the four newest `master` preview deployments as rolling anchors. Because each cleanup-log commit creates a new preview, the exact retained URLs should be confirmed from Vercel with `npx vercel ls tennis-data --scope tennis-data` rather than hard-coded here.
- Left production deployments intact as rollback anchors.

Verification:

- Vercel API scan checked 250 deployments after pruning and reported 4 remaining Preview deployments, 4 `master` previews, and 0 old `master` previews beyond the kept anchors.
- `npx vercel inspect https://www.tenaceiq.com --scope tennis-data` reported production deployment `tennis-data-6w079qjdn-tennis-data.vercel.app` as `Ready`.
- `npx vercel inspect https://tennis-data-p127trrp8-tennis-data.vercel.app --scope tennis-data` reported the latest Preview deployment as `Ready`.
- Local working tree was clean after the remote cleanup.
