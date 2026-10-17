<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## TenAceIQ Product North Star

TenAceIQ helps tennis players, captains, and league coordinators spend less time guessing, more time understanding, and more time playing.

Keep enhancements aligned to simple role-based tiers:

- Free: explore players, teams, leagues, rankings, and public tennis intelligence.
- Player: unlock My Lab, follows, matchup insight, and a player-linked personalized experience.
- Captain: includes Player features plus captain tools for lineups, scouting, readiness, and weekly team decisions.
- TIQ League Coordinator/Admin: run leagues of players or teams with structure, visibility, rankings, results, and admin workflows.

Favor short, tennis-specific copy and practical tools over generic dashboards, bloated feature lists, or decorative pages that do not help users act. Reuse centralized product and tier language from `lib/product-story.ts` when adding tier-related UI or copy.

Write product copy for the end user, not for the developer, product owner, or internal design review. Visible language should speak directly to players, captains, coaches, league coordinators, and tournament organizers about what they can understand or do next. Avoid meta commentary such as "the homepage should," "this section," "this board," "this component," or implementation/design rationale in user-facing UI.

## TenAceIQ Development Workflow

Default to focused, low-noise iteration:

- Start with targeted inspection, focused tests, and the smallest browser smoke check that proves the change.
- Use production-bundle smoke checks for CSS, layout, routing, or deployment-sensitive behavior when local dev/Turbopack may be misleading.
- Save full verification (`lint`, `typecheck`, full test suite, build, and live smoke when relevant) for the final pass before opening, merging, or shipping a PR.
- Keep CI and deployment polling quiet: check status at useful intervals and report only actionable failures, completion, or a clear blocker.
- Do not skip full verification for broad, risky, shared, or production-facing changes; run it once the focused loop says the change is ready.

## TenAceIQ Cost-Aware Engineering

Treat paid infrastructure usage as part of correctness. Follow `docs/deployment-workflow.md` for release decisions.

- Iterate locally with focused tests and browser checks. Use a local production bundle for deployment-sensitive behavior; a Vercel build is not a routine verification step.
- Batch related, reviewable fixes before pushing. Do not push or create a paid preview for each cosmetic iteration. Documentation-only work needs document checks, not a cloud deployment.
- Use Git deployment from `master` as the default production path after confirming the current Vercel production branch. Never run a manual production deploy and then merge the same change into an automatically deploying branch. Reuse or promote an already verified artifact when an intentional manual release is necessary; do not rebuild it solely to obtain another URL.
- Before any cloud deployment, inspect existing deployments for the intended commit and environment. Reuse a ready deployment or wait for one already building. Retry only after an actionable failure or a material change.
- Use a preview only when it proves something local checks cannot, such as hosted auth, webhooks, or device access. Use staging only when the release requires a stable shared review environment. Do not automatically run both lanes for every change.
- Keep full verification and required CI gates for releases and broad or risky changes. Run once per candidate; repeat only for new changes, failures, or unresolved evidence. Cost control must not weaken correctness, security, accessibility, or performance checks.
- After release, run one bounded smoke of affected routes and inspect a short log window. Avoid repeated broad production crawls, continuous polling, or load tests against paid production services unless requested or necessary to diagnose a specific incident.
- Before increasing cron frequency, collector concurrency, refresh scope, polling, retries, or logging, estimate request volume and runtime. Jobs should skip unchanged or not-yet-due work, checkpoint progress, and back off on errors. Preserve agreed freshness and measure throughput before changing cadence.
- Preserve useful error reporting and performance signals. Avoid verbose per-record success logs, duplicate telemetry, and unnecessary paid monitoring features. Attribute costs to routes/jobs before reducing observability or backend capacity.
- For cost investigations, compare equal time windows and separate effective usage, billed charges, credits, and subscription fees. Do not infer a traffic spike or a job's cost from team totals alone.
- Do not raise budgets, enable paid features, or pause production as a substitute for eliminating waste. Report any remaining measured cost driver and the tradeoff of a proposed runtime change.

## TenAceIQ Brand Source of Truth

Use only `public/brand/` as the production source of truth for TenAceIQ logos, app icons, favicons, social cards, and approved wallpapers. Read `public/brand/docs/MANIFEST.txt` and `public/brand/docs/CODEX_IMPLEMENTATION_PROMPT.txt` before changing brand presentation.

- Do not source TenAceIQ artwork from generated `output/`, `artifacts/`, `deliverables/`, screenshots, old worktrees, temporary folders, or presentation exports.
- Never restore the retired `public/tiq/logo/`, `public/tenaceiq/logos/`, or `public/tenaceiq-icon-*` asset families.
- Root browser compatibility files are deployment aliases derived from `public/brand/icons/`; they are not editable masters.
- `components/brand/TiqFeatureIcon.tsx` is the approved product-navigation icon system, not a source for the TenAceIQ logo.
- Do not redraw, filter, recolor, crop, stretch, round, or otherwise reinterpret supplied brand artwork.
