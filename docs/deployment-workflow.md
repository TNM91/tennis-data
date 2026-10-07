# Deployment Workflow

TenAceIQ uses Vercel Git deployments and GitHub Actions checks.

## Environments

- `master`: production. A push or merge to `master` deploys the live site.
- `staging`: stable test lane. A push or merge to `staging` creates a Vercel preview deployment for final web, tablet, and phone review before production.
- Pull request branches: previews only when hosted verification is needed. Respect `vercel.json` branch deployment exclusions; do not bypass them with routine manual deployments.
- Local development: `npm run dev` for fast iteration before opening a PR.

## Standard Flow

1. Create a feature branch from `master`.
2. Iterate locally and batch related changes. For deployment-sensitive checks, build locally and smoke the production bundle.
3. Run full release verification once for the final candidate and open a PR. Required GitHub CI must pass.
4. Reuse an existing preview when hosted behavior needs proof. Use `staging` only when a stable shared device-review lane is necessary; it is not an extra mandatory build for every PR.
5. Confirm Vercel's current production branch is `master` and inspect existing deployments for the candidate commit. Resolve a mismatch before choosing a release path; do not assume an old checklist reflects current settings.
6. Merge to `master` for one Git production deployment. Do not manually deploy the same change before merging. Wait for the existing build instead of starting another.
7. Run one bounded live smoke of affected behavior and review recent errors. Repeat only when a failure or new evidence warrants it.

## Required Checks

- GitHub CI: `Verify` and `TIQ Schema Audit`.
- Vercel preview deployment: completed successfully when hosted review is needed.
- Manual smoke for major UI changes:
  - Logged-out desktop.
  - Logged-out iPhone.
  - Logged-in member header and portal navigation.
  - Tablet or narrow web around the compact-header breakpoint.

## Production Rule

Use `master` as the only production branch. Treat `staging` as a rehearsal lane, not the source of truth.

An emergency manual release or rollback must have a concrete reason and a verified artifact. Prefer promoting an existing ready artifact to rebuilding it. Inspect the current commit/environment first, and account for any subsequent Git deployment so it does not duplicate the release. Never force a fresh cloud build solely to repeat a smoke check.

## Runtime Cost and Performance

Cloud development builds and live checks consume paid resources even when they add no user value. Local checks are the default. Keep production smoke requests and log queries bounded; avoid repeatedly running overlapping launch suites for a small fix.

Before tuning runtime costs, compare equal billing windows and identify the responsible route or job. Track request count, CPU, provisioned memory, monitoring events, and build usage separately from subscription fees and credit application. Aggregate billing alone cannot attribute a cost to a collector or establish an exact budget balance.

Collectors and refresh jobs must retain their freshness and completeness goals. Prefer skipping unchanged work, caching reusable results, bounded batches, and error backoff to simply reducing capacity. Verify latency, error rate, data freshness, and queue progress when changing runtime behavior. Keep useful error and performance monitoring while avoiding verbose success events and duplicate instrumentation.

Check usage after a material runtime change or a billing alert. Future recurring monitoring requires a requested schedule; do not create one automatically.
