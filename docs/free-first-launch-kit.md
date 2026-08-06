# TenAceIQ Free-First Launch Kit

Use this kit while paid plans are in early access and production checkout is paused.

## Positioning

**More Tennis. Less Chaos.**

TenAceIQ helps the tennis community spend less time searching, guessing, and coordinating—and more time playing, improving, and enjoying tennis.

Primary action: [Explore free](https://www.tenaceiq.com/explore)

Secondary action: [Join early access](https://www.tenaceiq.com/pricing)

## Ready-to-post copy

### Short social post

More Tennis. Less Chaos. Explore players, teams, leagues, rankings, and tournaments for free with TenAceIQ.

https://www.tenaceiq.com/explore

### Longer social or LinkedIn post

TenAceIQ is now open for free tennis exploration.

Search players, teams, leagues, rankings, and tournaments in one place. Use the context to make the next tennis decision clearer—with less searching and less guesswork.

Paid Player, Coach, Captain, League, and Full-Court tools are opening soon. Join early access if you want to be first in line.

Explore free: https://www.tenaceiq.com/explore

### Email

Subject: **Explore tennis with TenAceIQ**

Preview: Search players, teams, leagues, rankings, and tournaments for free.

TenAceIQ is now open for free tennis exploration.

Search players, teams, leagues, rankings, and tournaments in one place, then use the context to make the next tennis decision clearer.

Paid Player, Coach, Captain, League, and Full-Court tools are opening soon. You can join early access without entering payment information.

[Explore free](https://www.tenaceiq.com/explore)

### Direct beta invitation

I am opening TenAceIQ to a small group of tennis players, captains, coaches, and organizers. Explore the public tennis map for free, then tell me what would make your next tennis decision easier: https://www.tenaceiq.com/explore

## Feedback prompt

Ask three things:

1. What were you trying to do?
2. Where did you hesitate?
3. What would have made the next step obvious?

## Screenshot sequence

Capture these in phone and desktop sizes:

1. `/` — role-based platform entry.
2. `/explore` — the first free action.
3. `/explore/players` — player discovery.
4. `/explore/teams` — team discovery.
5. `/explore/leagues` — league discovery.
6. `/pricing` — paid tools clearly marked as early access.

Use public/free screenshots now. Add signed-in Player, Coach, Captain, League, and Full-Court screenshots only after their authenticated QA fixtures pass.

## Authenticated screenshot setup

The paid-role screenshot set is intentionally blocked until private QA accounts are configured.

1. Run `npm run qa:fixture-auth-smoke -- --env` to print the credential names.
2. Store the QA emails and passwords only in `.env.local` or the local shell.
3. Run `npm run qa:fixture-auth-smoke -- all` against production.
4. Capture a signed-in role only after its smoke passes without an upgrade lock.

Never use a real customer account or place credentials in this document, source control, chat, screenshots, or Vercel application variables.

## Publishing order

1. Invite a small group directly.
2. Watch their first sessions and collect the three-question feedback.
3. Fix any repeated point of hesitation.
4. Post the wider social and email announcement.
5. Monitor production logs, Web Analytics, and Speed Insights after sharing links.

## Copy guardrails

- Lead with what someone can do now: explore tennis for free.
- Say paid tools are “opening soon” or “early access.”
- Do not say paid plans are available while checkout is paused.
- Do not imply a direct USTA API connection. Say users can contribute TennisLink exports through Data Assist.
- Keep claims short, tennis-specific, and demonstrable on the linked page.

Run `npm run qa:announcement` to print the current free-first packet from centralized product language. Use `npm run qa:announcement -- --paid` only after the Stripe live cutover and controlled purchase pass are complete.
