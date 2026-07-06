<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## TenAceIQ Product North Star

TenAceIQ helps tennis players, captains, and league coordinators spend less time guessing, more time understanding, and more time playing.

Keep enhancements aligned to simple role-based tiers:

- Free: explore players, teams, leagues, rankings, and public tennis intelligence.
- Player: unlock My Lab, follows, matchup insight, and a player-linked personalized experience.
- Captain: includes Player features plus captain tools for lineups, scouting, readiness, and weekly team decisions.
- TIQ League Coordinator/Admin: run leagues of players or teams with structure, visibility, rankings, results, and admin workflows.

Favor short, tennis-specific copy and practical tools over generic dashboards, bloated feature lists, or decorative pages that do not help users act. Reuse centralized product and tier language from `lib/product-story.ts` when adding tier-related UI or copy.

## TenAceIQ Development Workflow

Default to focused, low-noise iteration:

- Start with targeted inspection, focused tests, and the smallest browser smoke check that proves the change.
- Use production-bundle smoke checks for CSS, layout, routing, or deployment-sensitive behavior when local dev/Turbopack may be misleading.
- Save full verification (`lint`, `typecheck`, full test suite, build, and live smoke when relevant) for the final pass before opening, merging, or shipping a PR.
- Keep CI and deployment polling quiet: check status at useful intervals and report only actionable failures, completion, or a clear blocker.
- Do not skip full verification for broad, risky, shared, or production-facing changes; run it once the focused loop says the change is ready.
