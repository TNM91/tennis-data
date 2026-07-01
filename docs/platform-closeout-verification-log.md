# TenAceIQ Platform Closeout Verification Log

Use this as the running evidence log for platform closeout. Keep detailed bugs in issue tracking or daily notes; this file records the high-level verification passes that matter for release confidence.

## 2026-07-01 Production Health Smoke Recheck

Commands:

- `npm run qa:launch`
- `npm run verify:closeout:live`
- `npm run qa:adsense-live`
- `npm run qa:prod-logs`
- `npx vercel inspect https://tennis-data-6mmmi43th-tennis-data.vercel.app --scope tennis-data`

Base URL: `https://www.tenaceiq.com`

Result: pass

Checks passed:

- Customer journey launch gate passed with 9/9 journeys and 0 open p0/p1 rows.
- Production deployment `tennis-data-6mmmi43th-tennis-data.vercel.app` is `Ready` and aliased to `https://www.tenaceiq.com` and `https://tenaceiq.com`.
- Tier copy consistency passed across Free, Player, Coach, Captain, League, and Full-Court.
- Coach-player Level Up contract tests passed: 3 files, 29 tests.
- Level Up content quality tests passed: 1 file, 7 tests.
- Platform closeout inventory tests passed: 3 files, 71 tests.
- Production route smoke checked 17 routes and accepted expected signed-out redirects for protected Coach and Captain routes.
- Production Level Up player loop smoke verified mobile load, direct active card, proof rating and note save, next-action copy, and localStorage persistence.
- Production portal overflow smoke passed.
- AdSense live readiness passed for public pages, trust pages, `ads.txt`, `robots.txt`, `sitemap.xml`, and private-route ad exclusions.
- Production runtime log smoke passed with 0 recent errors, 0 fatals, 0 HTTP 500s, and 0 warnings for the checked 2-hour window.
- GitHub CI passed on both `master` and `main` for commit `1dc7f53f Add production log smoke`.

Remaining manual item:

- Stripe can stay in test mode until the intentional live-mode cutover. Run `npm run qa:stripe-live-mode` only after live Stripe keys, live price IDs, and webhook secrets are set for production.

## 2026-06-30 Final Production Closeout Recheck

Commands:

- `npm run qa:launch`
- `npx vercel inspect https://www.tenaceiq.com --scope tennis-data`
- `npx vercel logs https://www.tenaceiq.com --since 1h --level error --scope tennis-data`
- `npm run verify:closeout:live`

Base URL: `https://www.tenaceiq.com`

Result: pass

Checks passed:

- Customer journey launch gate passed with 9/9 journeys and 0 open p0/p1 rows.
- Production deployment `tennis-data-6w079qjdn-tennis-data.vercel.app` is `Ready`.
- Error-level production runtime log query for the checked 1-hour window returned no logs.
- Tier copy consistency passed across Free, Player, Coach, Captain, League, and Full-Court.
- Coach-player Level Up contract tests passed: 3 files, 29 tests.
- Level Up content quality tests passed: 1 file, 7 tests.
- Platform closeout inventory tests passed: 3 files, 71 tests.
- Production route smoke checked 17 routes and accepted expected signed-out redirects for protected Coach and Captain routes.
- Production Level Up player loop smoke verified mobile load, direct active card, proof rating and note save, next-action copy, and localStorage persistence.
- Production portal overflow smoke passed.

Remaining manual item:

- Vercel project Git production branch still needs to be changed from `main` to `master` in the Vercel dashboard. CLI/API patch attempts remain rejected by validation, so production deploys should stay explicit verified promotions until the dashboard setting is corrected.

## 2026-06-29 Production Monitoring And Runtime Alignment Check

Commands:

- `npx vercel inspect https://www.tenaceiq.com --scope tennis-data`
- `npx vercel logs https://www.tenaceiq.com --since 1h --level error --scope tennis-data`

Base URL: `https://www.tenaceiq.com`

Result: pass

Checks passed:

- Production deployment `tennis-data-6w079qjdn-tennis-data.vercel.app` is `Ready`.
- Production aliases include `https://www.tenaceiq.com` and `https://tenaceiq.com`.
- Error-level production runtime log query for the last hour returned no logs.

Runtime alignment:

- Repository runtime remains pinned to Node `22.x` in `package.json` and `.nvmrc`.
- GitHub CI was updated to run on `main` and `master`, and to use Node `22` for both verify and TIQ schema audit jobs.
- GitHub workflow actions were updated from `actions/checkout@v4` and `actions/setup-node@v4` to `actions/checkout@v7` and `actions/setup-node@v6` to clear the Actions Node 20 deprecation warning.
- Vercel project metadata was aligned from Node `24.x` to Node `22.x` with `npx vercel api /v9/projects/prj_v5O8xWepQDShD0EzC6R6ooS0IlW0 --method PATCH --field nodeVersion=22.x --silent`.
- `npx vercel project inspect tennis-data --scope tennis-data` confirmed Node.js Version `22.x` after the update.

Git production branch alignment:

- GitHub default branch and active release branch are `master`.
- Vercel project metadata still reports Git production branch `main`, while the current production deployment was promoted from `master`.
- CLI/API attempts to patch `productionBranch=master` and `gitProductionBranch=master` were rejected with `400` validation errors, so this should be changed in the Vercel dashboard rather than forced through unverified nested API fields.
- Until that dashboard setting is changed, treat production deploys as explicit verified promotions instead of relying on automatic production deployment from `master` pushes.

## 2026-06-29 Launch-Ready Production Closeout Recheck

Command: `npm run verify:closeout:live`

Base URL: `https://www.tenaceiq.com`

Result: pass

Checks passed:

- Tier copy consistency across Free, Player, Coach, Captain, League, and Full-Court.
- Coach-player Level Up contract tests: 3 files passed, 29 tests passed.
- Level Up content quality tests: 1 file passed, 7 tests passed.
- Platform closeout inventory tests: 3 files passed, 71 tests passed.
- Expanded production platform route smoke checked 17 routes.
- Production Level Up player loop smoke verified mobile proof save, next-action copy, and localStorage persistence.
- Production portal overflow smoke passed.

Evidence:

- Route smoke accepted the expected signed-out redirects for protected Coach and Captain routes.
- Player loop smoke verified `relentless-competitor-4-0` with `serve-target-call`.
- The first sandboxed Playwright launch failed with `spawn EPERM`; rerunning the same live closeout with approved escalation passed, confirming an execution-permission issue rather than a product failure.

Launch QA state:

- Signed-in production QA is complete across Free, Player, Coach, Captain, League, Full-Court, and Admin.
- `npm run qa:readiness` reports 11/11 docs present, 9/9 start commands registered, 9/9 journeys with pass evidence, 0 open p0/p1 rows, and launch-ready ledger state.

## 2026-06-29 Cleanup Sync Production Deployment

Command: `vercel deploy --prod --yes --scope tennis-data`

Base URL: `https://www.tenaceiq.com`

Result: pass

Deployment:

- Production deployment: `tennis-data-e7q4iqr3v-tennis-data.vercel.app`
- Vercel deployment id: `dpl_G394YELu3QaUNFFYiK27PvgzsfAx`
- Commit: `edae2d4d`

Checks passed:

- Vercel production build completed successfully in about 3 minutes.
- Production alias `www.tenaceiq.com` points to `dpl_G394YELu3QaUNFFYiK27PvgzsfAx`.
- Production route smoke returned `200` for `/`, `/explore`, `/pricing`, `/mylab`, `/tactics`, `/data-assist`, and `/favicon.ico`.

## 2026-06-29 Cleanup Production Promotion

Command: `vercel promote https://tennis-data-1l7xhv3gi-tennis-data.vercel.app --yes`

Base URL: `https://www.tenaceiq.com`

Result: pass

Deployment:

- Production deployment: `tennis-data-g6g2yhnpl-tennis-data.vercel.app`
- Vercel deployment id: `dpl_4wKr3kNEL6LTUv8NL2egbvvfJnqd`
- Commit: `85eb40c`

Checks passed:

- Vercel production build completed successfully in about 3 minutes.
- Production route smoke returned `200` for `/`, `/explore`, `/pricing`, `/mylab`, `/tactics`, and `/data-assist`.
- `npm audit --omit=dev` reported zero production vulnerabilities before promotion.
- Full `npm audit` reported zero vulnerabilities after dev lockfile cleanup.
- `npm run audit:artifacts` reported no generated or oversized local artifacts.
- Vercel production logs returned no recent runtime logs after deployment.

Historical note:

- At this point in the cleanup sequence, launch readiness was blocked by signed-in fixture credentials, not by deployment health. This was superseded by the 2026-06-29 launch-ready closeout recheck above after production QA fixtures were provisioned and signed-in journey evidence passed.

## 2026-06-05 Expanded Production Closeout Pass

Command: `npm run verify:closeout:live`

Base URL: `https://www.tenaceiq.com`

Result: pass

Checks passed:

- Tier copy consistency across Free, Player, Coach, Captain, League, and Full-Court.
- Coach-player Level Up contract tests.
- Level Up content quality tests.
- Platform closeout inventory and customer journey test agenda checks.
- Expanded production platform route smoke.
- Production Level Up player loop smoke on mobile viewport.
- Production portal overflow smoke on desktop and mobile viewports.

Evidence:

- Platform route smoke checked 17 production routes across Free, Player, Coach, Captain, League, and Admin.
- Expanded route coverage includes Data Assist, leagues, Coach Planner, and protected Admin Access.
- Level Up player loop verified `relentless-competitor-4-0` with `serve-target-call`.
- Verified mobile route load, direct card active mode, active-card framing, proof rating, tiny note save, next-practice/coach-update copy, and localStorage persistence.

Note:

- `/admin/access` correctly presents the protected TenAceIQ access gate when no admin session is present. Route smoke accepts that as the expected signed-out protected state.

## 2026-06-05 Production Closeout Pass

Command: `npm run verify:closeout:live`

Base URL: `https://www.tenaceiq.com`

Result: pass

Checks passed:

- Tier copy consistency across Free, Player, Coach, Captain, League, and Full-Court.
- Coach-player Level Up contract tests.
- Level Up content quality tests.
- Platform closeout inventory and customer journey test agenda checks.
- Production platform route smoke.
- Production Level Up player loop smoke on mobile viewport.
- Production portal overflow smoke on desktop and mobile viewports.

Evidence:

- Platform route smoke checked 13 production routes before route coverage was expanded.
- Level Up player loop verified `relentless-competitor-4-0` with `serve-target-call`.
- Verified mobile route load, direct card active mode, active-card framing, proof rating, tiny note save, next-practice/coach-update copy, and localStorage persistence.

Note:

- The first sandboxed Playwright launch failed with `spawn EPERM`. The same command passed when rerun with approved escalation, so this was an execution-permission issue, not a product failure.

## Next Verification Target

Use post-launch monitoring rather than more fixture setup:

1. Run `npm run qa:post-launch -- --live` after each production deploy or broad launch announcement.
2. Check Vercel production deployment health and runtime logs after each production deploy.
3. Rerun `npm run verify:closeout:live` before broad launch announcements or after any auth, tier, or navigation change.
4. Keep using `npm run qa:launch` as the manual-evidence launch gate; it should stay green unless new journeys are added.
5. Run `npm run qa:vercel-branch` after the Vercel dashboard production branch is changed from `main` to `master`.
