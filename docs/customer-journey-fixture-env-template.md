# TenAceIQ Fixture Env Template

Use this as the non-secret template for local QA fixture credentials. Keep real values in `.env.local` or the shell only. Do not commit filled-in credentials.

## Production QA

```env
TENACEIQ_QA_BASE_URL=https://www.tenaceiq.com

TENACEIQ_QA_COACH_EMAIL=
TENACEIQ_QA_COACH_PASSWORD=
TENACEIQ_QA_PLAYER_EMAIL=
TENACEIQ_QA_PLAYER_PASSWORD=

TENACEIQ_QA_CAPTAIN_EMAIL=
TENACEIQ_QA_CAPTAIN_PASSWORD=
TENACEIQ_QA_LEAGUE_EMAIL=
TENACEIQ_QA_LEAGUE_PASSWORD=
TENACEIQ_QA_FULL_COURT_EMAIL=
TENACEIQ_QA_FULL_COURT_PASSWORD=
TENACEIQ_QA_ADMIN_EMAIL=
TENACEIQ_QA_ADMIN_PASSWORD=
```

## Local QA

Use local only when a dev server is running.

```env
TENACEIQ_QA_BASE_URL=http://localhost:3000
```

## Smoke Commands

```bash
npm run qa:fixture-auth-smoke -- --env
npm run qa:fixture-auth-smoke
npm run qa:fixture-auth-smoke -- coach_primary
npm run qa:fixture-auth-smoke -- player_plus_linked
npm run qa:fixture-auth-smoke -- captain_primary
npm run qa:fixture-auth-smoke -- league_coordinator
npm run qa:fixture-auth-smoke -- full_court_operator
npm run qa:fixture-auth-smoke -- admin_test
npm run qa:fixture-auth-smoke -- paid
npm run qa:fixture-auth-smoke -- all
```

## Rule

The smoke command may print missing key names, but it must never print credential values.
