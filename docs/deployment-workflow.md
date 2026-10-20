# Deployment Workflow

TenAceIQ uses Vercel Git deployments and GitHub Actions checks.

## Environments

- `master`: production. A push or merge to `master` deploys the live site.
- `staging`: stable test lane. A push or merge to `staging` creates a Vercel preview deployment for final web, tablet, and phone review before production.
- Pull request branches: automatic previews are disabled by default. Only `master` and the intentional `staging` lane auto-deploy. Create a preview only when hosted verification is needed; do not bypass `vercel.json` exclusions for routine iteration.
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

Account for recurring hosting and database costs before setting an overage budget; domain renewals and other providers are separate. Never claim a guaranteed combined cap from either provider's individual spending control. Keep account-specific billing amounts and usage exports out of repository documentation.

The scheduled full rating rebuild runs daily at 08:17 UTC, with at most one successful scheduled rebuild per UTC day. Results collected afterward remain queued until the next daily pass. Source collection keeps its existing cadence, checkpoints, and error backoff. Only the collector slot immediately before that daily rating run is reserved.

Separate automated training/SEO crawls and scheduled rating work from human traffic and cloud build charges. Robots exclusions request crawler cooperation; an enforced firewall rule must be reviewed separately. Preserve Google/Bing indexing and social link previews.

## Supabase Data API Grants

From October 30, 2026, new tables in `public` do not inherit Data API grants automatically. Existing production tables retain their grants, but fresh projects, preview branches, and database resets must be checked separately.

- Include explicit grants in the migration that creates a table. Grant only the operations and roles that its callers require; RLS policies do not replace table grants.
- Keep private and service-only tables private. Do not copy a blanket `anon` or `authenticated` CRUD grant across the schema.
- Check `service_role` access explicitly for server APIs and collectors, and sequence permissions when a caller inserts through an identity/serial sequence.
- Validate newly created tables with their actual API role after a reset or migration. Legacy migrations relying on inherited grants need a role-by-role audit before a fresh environment is treated as ready.
