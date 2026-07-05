# Deployment Workflow

TenAceIQ uses Vercel Git deployments and GitHub Actions checks.

## Environments

- `master`: production. A push or merge to `master` deploys the live site.
- `staging`: stable test lane. A push or merge to `staging` creates a Vercel preview deployment for final web, tablet, and phone review before production.
- Pull request branches: short-lived preview deployments for focused changes.
- Local development: `npm run dev` for fast iteration before opening a PR.

## Standard Flow

1. Create a feature branch from `master`.
2. Open a PR and use the Vercel preview URL for focused review.
3. Merge into `staging` when a change needs a stable test lane or broader device QA.
4. Verify staging on desktop, tablet, and iPhone.
5. Open or fast-forward the production PR into `master`.
6. Merge to `master` only after GitHub CI and the staging review pass.

## Required Checks

- GitHub CI: `Verify` and `TIQ Schema Audit`.
- Vercel preview deployment: completed successfully.
- Manual smoke for major UI changes:
  - Logged-out desktop.
  - Logged-out iPhone.
  - Logged-in member header and portal navigation.
  - Tablet or narrow web around the compact-header breakpoint.

## Production Rule

Use `master` as the only production branch. Treat `staging` as a rehearsal lane, not the source of truth.
