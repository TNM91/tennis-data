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
