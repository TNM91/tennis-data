# TenAceIQ Platform Closeout Verification Log

Use this as the running evidence log for platform closeout. Keep detailed bugs in issue tracking or daily notes; this file records the high-level verification passes that matter for release confidence.

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

Note:

- Launch readiness is still blocked by signed-in fixture credentials, not by deployment health. `npm run qa:fixture-auth-smoke -- coach_primary` is blocked until `TENACEIQ_QA_COACH_EMAIL` and `TENACEIQ_QA_COACH_PASSWORD` are set; `npm run qa:fixture-auth-smoke -- player_plus_linked` is blocked until `TENACEIQ_QA_PLAYER_EMAIL` and `TENACEIQ_QA_PLAYER_PASSWORD` are set.

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

Use real test accounts to execute the first signed-in Day 1 journey in `docs/customer-journey-test-plan.md`:

1. Set `TENACEIQ_QA_BASE_URL=https://www.tenaceiq.com`, `TENACEIQ_QA_COACH_EMAIL`, `TENACEIQ_QA_COACH_PASSWORD`, `TENACEIQ_QA_PLAYER_EMAIL`, and `TENACEIQ_QA_PLAYER_PASSWORD` in `.env.local` or the shell.
2. Run `npm run qa:fixture-auth-smoke -- coach_primary` and `npm run qa:fixture-auth-smoke -- player_plus_linked`.
3. Run `npm run qa:live-card -- coach-player-assigned-challenge --date=2026-06-29 --tester=<name> --device=phone` after both fixtures authenticate.
