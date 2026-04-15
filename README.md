# TenAceIQ

TenAceIQ is a tennis intelligence platform focused on player discovery, rankings, leagues, matchup analysis, and captain workflow tools.

## Local development

Run the app locally with:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Production build

Run the verification commands before deploy:

```bash
npm run lint
npm run build
```

## Scorecard Review Persistence

The admin import flow now supports review-safe scorecard preview, approval, and audit metadata.

- Local browser persistence for reviewer name and per-line review overrides is automatic in `/admin/import`.
- Best-effort server persistence is wired into the ingestion engine and will write review metadata when your Supabase schema supports it.
- An optional SQL starter for review/audit columns and a dedicated audit table lives in [docs/scorecard-review-audit.sql](./docs/scorecard-review-audit.sql).

## AdSense rollout

The site is already wired for:

- publisher id `ca-pub-1351888380884789`
- `ads.txt`
- ad-safe route gating
- prepared public placements on content-rich pages only

To activate prepared placements, add real slot ids to your production environment:

```bash
NEXT_PUBLIC_ADSENSE_SLOT_HOME_INLINE=
NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE_INLINE=
NEXT_PUBLIC_ADSENSE_SLOT_RANKINGS_INLINE=
NEXT_PUBLIC_ADSENSE_SLOT_PLAYERS_INLINE=
NEXT_PUBLIC_ADSENSE_SLOT_LEAGUES_INLINE=
NEXT_PUBLIC_ADSENSE_SLOT_TEAMS_INLINE=
NEXT_PUBLIC_ADSENSE_SLOT_MATCHUP_INLINE=
```

You can copy the variable names from [.env.example](./.env.example).

## Launch checklist

Use the full rollout checklist in [docs/adsense-launch-checklist.md](./docs/adsense-launch-checklist.md).

The most important live checks are:

- verify `https://tenaceiq.com/ads.txt`
- verify `support@tenaceiq.com` and `hello@tenaceiq.com`
- confirm ads only render on approved public pages
- confirm private and utility routes remain ad-free and `noindex`
- re-read the live public site as a first-time visitor before requesting review
