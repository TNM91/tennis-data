# USTA Connect Innovation Challenge Submission Prep

Prepared: July 1, 2026

Deadline from USTA email: July 3, 2026

Challenge page from USTA email: http://usta.com/innovationchallenge

Rules reviewed from: `C:\Users\nmein\Downloads\usta-connect-innovation-challenge-rules-2026.pdf`

## Official Rules Takeaways

This is a two-stage contest:

1. Entry form by July 3, 2026 at 11:59 p.m. ET.
2. Up to 12 qualified teams are selected by July 10, then must pass security and identity checks.
3. USTA data access is released to qualified teams around July 11.
4. Decisive Round package is due August 9, 2026 at 11:59 p.m. ET.
5. Virtual judging happens August 10-14.
6. Top 3 finalists pitch live at the US Open USTA Connect event on September 3.

Judging weights:

- Accretive impact on USTA Mission or Pro Tennis: 50%
- Innovation and creativity: 30%
- Technical feasibility and data execution: 20%

Best fit category for TenAceIQ:

> Open Category: 35 Million Players by 2035

Secondary fit:

> Mission-Driven: Hyper-Personalized Player Experiences

Why: TenAceIQ is strongest as a participation, retention, and league engagement product. It should be framed around helping more people play, return, captain, coordinate, and stay connected to tennis through clearer league experiences.

Important rule constraints:

- USTA National employees and current USTA National vendors with active contracts are not eligible.
- Business entities can enter through an authorized representative.
- One entry per team; individuals can participate on only one team.
- Qualified teams receive anonymized and/or aggregated USTA datasets only after vetting.
- USTA data may be used solely for the contest and dataset-specific terms.
- No re-identification attempts.
- No sharing USTA data outside identified team members.
- No scraping or exporting USTA data outside allowed interfaces except ephemeral processing needed for the prototype.
- USTA data and derivatives containing USTA data must be securely deleted within 30 days after the contest ends or sooner if requested.
- Do not put USTA data into public LLMs, public analytics systems, or tools that could retain it.
- Decisive Round requires a working prototype, written overview, SBOM, 3-5 minute demo video, and disclosures for OSS, licenses, third-party IP, datasets, known limits, and risks.
- Entrant keeps pre-existing IP and submission ownership, but USTA gets a limited license for contest administration, judging, showcasing, marketing around entries, and internal evaluation. Broader commercial use requires a separate agreement.

## Recommended Submission Positioning

Submit TenAceIQ as a focused USTA league intelligence product, not as a broad tennis platform.

Primary angle:

> TenAceIQ turns USTA participation data into practical decisions that help players prepare, captains lead, and coordinators keep tennis easier to join and continue.

Short version:

> TenAceIQ helps players prepare, captains build smarter lineups, and coordinators run seasons with less admin work by turning league, roster, schedule, result, and player context into role-specific tennis intelligence.

Best contest wedge:

> Participation Intelligence for USTA League Tennis

Scoring-optimized wedge:

> TenAceIQ helps USTA grow and retain players by turning league participation data into clearer player prep, better captain decisions, and easier coordinator operations.

Why this is the right wedge:

- USTA league tennis has high participation and high coordination friction.
- Captains are unpaid operators making weekly decisions from scattered data, texts, rosters, scorecards, and schedules.
- Players want matchup context and improvement guidance, not raw tables.
- Coordinators need trusted results, standings, schedules, and public visibility without spreadsheet cleanup.
- TenAceIQ already has working role surfaces for public discovery, My Lab, Matchup, Team Hub, League Office, Data Assist, and admin review.
- This connects directly to the highest-weight judging criterion: impact on the USTA mission.

## Claim Safety

Use this wording:

> TenAceIQ is built to work with approved USTA data access, TennisLink exports, and user, captain, or coordinator-provided match data. Imported data moves through review and trust checks before shaping platform intelligence.

Avoid this wording unless formally true:

- "We have a direct USTA API integration."
- "TenAceIQ is an official USTA product."
- "We can automatically ingest all USTA data."
- "We own USTA league data."
- "Our predictions are guaranteed."

Before final submission, review the official rules for:

- IP ownership and license rights granted by applicants
- Use of submitted demos, screenshots, and public pitch materials
- Whether finalist participation requires public disclosure
- Whether USTA data usage requires a particular access method
- Any restrictions on existing commercial products

Rules-specific note:

> Initial entry should describe anticipated data sources and the existing TenAceIQ product. Do not imply that TenAceIQ already has access to contest-provided USTA datasets. If selected, USTA provides anonymized and/or aggregated datasets after security and identity checks.

## Data and Security Posture

Use this in the application if there is a privacy/security field:

> TenAceIQ will treat contest-provided USTA datasets as contest-only data. Access will be limited to approved team members, data will not be shared outside the team, and anonymized data will not be used for re-identification. Contest data will not be pasted into public LLMs or third-party tools that retain prompts or files. Any prototype features using USTA-provided datasets will keep raw contest data separate from TenAceIQ production data unless USTA separately authorizes a production pathway. At the end of the contest, TenAceIQ will securely delete USTA data and derivatives containing USTA data as required by the official rules.

If selected, set up:

- A separate contest branch or workspace.
- A separate database/schema or local encrypted data store for contest data.
- Access limited to named team members.
- A short data inventory: source, fields, storage location, purpose, retention/deletion owner.
- A deletion checklist for raw USTA data and derivatives.
- A no-public-LLM rule for any USTA-provided dataset rows, files, API responses, or derived records that could encode contest data.

## Form-Ready Application Answers

## Registration Form Paste Sheet

Source form: https://ustayeqzp.formstack.com/forms/usta_connect_innovation_challenge_registration_form

Use this section when filling the actual registration form. Items marked `[confirm]` require your personal, legal, or team-specific answer.

### Name

- First Name: `[your first name]`
- Last Name: `[your last name]`

### Email

`[your email]`

### Phone

`[your phone]`

### Address

`[your address]`

### Describe your idea, product, or innovation

Paste:

> TenAceIQ is a live tennis intelligence platform that turns league data into a better tennis week for players, captains, and coordinators. Today, USTA tennis generates valuable information - schedules, ratings, rankings, scorecards, standings, teams, facilities, and match history - but the people closest to the court still have to turn that information into decisions by hand.
>
> TenAceIQ makes that data useful at the moment it matters. A player can discover the tennis landscape, understand an upcoming matchup, and know what to work on next. A captain can see availability, compare lineup options, scout opponents, and send a clearer team brief. A coordinator can keep schedules, results, standings, and league visibility moving without rebuilding the season in spreadsheets.
>
> The strongest focus-area fit is the Open Category: 35 Million Players by 2035, because retention and growth depend on making organized tennis easier to join, understand, lead, and continue. TenAceIQ also aligns with Hyper-Personalized Player Experiences through My Lab and Matchup, which turn player and competition context into personalized prep and next actions. The goal is simple: help more people spend less time searching, guessing, and coordinating, and more time playing tennis.

### How would you use the datasets and resources?

Paste:

> TenAceIQ would use the Challenge datasets to build a controlled prototype called USTA Participation Mission Control: a working demo that shows how USTA data can help a player find the right tennis opportunity, prepare for a match, help a captain make a weekly lineup decision, and help a coordinator keep league play clear and visible.
>
> Facility and court data would power local discovery: where can someone play, what options are nearby, and how does a league or match fit into a real tennis week? Anonymized adult and junior play history would help identify participation patterns, recent-play signals, and season context without attempting to identify individuals. NTRP ratings and junior rankings would become competitive-level signals for matchup prep, readiness cues, and lineup planning. Selected US Open match statistics and Hawk-Eye tracking data would be used as an inspiration layer for richer player insight: showing how advanced performance patterns could become understandable coaching or prep cues for everyday players.
>
> The proof of concept would connect four surfaces: Explore for local tennis discovery, My Lab and Matchup for personalized player prep, Team Hub for captain lineup/readiness decisions, and League Office for coordinator schedule/result/standings visibility. The output would not be a generic dashboard. It would be a role-based demo where the same tennis context becomes the next useful action for each person.
>
> Contest-provided USTA datasets would remain isolated from production TenAceIQ data unless USTA separately authorizes a production pathway. Any AI-supported outputs would be labeled as decision support, not guarantees, and USTA data would not be uploaded to public AI tools, public repositories, or unsecured third-party services. The decisive-round package would include a hosted prototype or buildable repo, written overview, SBOM, 3-5 minute demo video, dataset/license disclosures, known limitations, and a deletion plan.

### LinkedIn Profile URL

`[your LinkedIn URL]`

### Twitter/X, Instagram, and/or TikTok URL

`[optional social URL or leave blank if allowed]`

### GitHub, portfolio, company website, or product demo URL

Paste:

`https://www.tenaceiq.com`

Optional if you want to include the repo/demo link:

`[private repo or demo link, only if you want to disclose it]`

### Applying As

Recommended:

- Check `Startup` if TenAceIQ is not yet a legally formed company.
- Check `Company` if TenAceIQ is legally formed.
- If you are entering personally and not through an entity, check `Individual` and optionally `Startup`.

### Team Name

Paste:

`TenAceIQ`

### Number of people on the team

`[confirm exact number]`

If solo:

`1`

### Full name and email address of each team member

Paste with real details:

`[Full Name] - [email]`

Only list people who are allowed to access USTA datasets if selected.

### Confirm no unlisted person will access USTA datasets

Check:

`I confirm that no unlisted person will access USTA datasets.`

### Conviction / adverse history question

Answer truthfully:

`[Yes/No + details if required]`

Do not use a prepared answer for this.

### Agree not to combine USTA datasets with external datasets for identifying individuals

Check:

`I agree not to combine USTA datasets with external datasets for the purpose of identifying individuals.`

### Agree not to share USTA data outside approved team

Check:

`I agree not to share USTA data with anyone outside the approved team.`

### Agree not to upload USTA data to public AI/tools/repos/file-sharing/unsecured services

Check:

`I agree not to upload USTA data to public AI tools, public repositories, file-sharing sites, or unsecured third-party services.`

### Cloud, AI, analytics, or development platforms expected

Paste:

> TenAceIQ is built with Next.js/React and TypeScript, with Supabase/Postgres-backed application workflows and Vercel hosting for the live product. For the Challenge, USTA data would be handled in an isolated contest workspace with access limited to approved team members. Any AI, analytics, or development tooling would be configured so USTA data is not uploaded to public AI tools, public repositories, public file-sharing sites, or unsecured services. We may use local or approved-environment scripts for parsing, analytics, SBOM generation, testing, and prototype development.

### Will your code repository be private?

Recommended:

`Yes`

### Will your solution store, copy, transform, or export USTA data outside the approved environment?

Paste:

> No, not outside the approved environment. USTA-provided datasets would be used only in an isolated contest workspace or other USTA-approved environment. Any transformations would be limited to contest prototype processing, role-specific derived metrics, and demo artifacts allowed by the rules. Raw USTA data would not be exported to public tools, public repositories, or production TenAceIQ systems unless USTA separately authorizes a production pathway.

### Agree to delete or return USTA data

Check:

`I agree to delete or return USTA data.`

### Agree to report suspected data leak, unauthorized access, or security issue

Check:

`I agree to report security issues.`

### Agree USTA may revoke access

Check:

`I understand and agree to revocation policies.`

### AI / ML / computer vision / LLM / automated decision-making

Paste:

> Yes. TenAceIQ may use analytics, scoring logic, and AI-assisted decision support to turn tennis context into player prep, captain lineup/readiness cues, and coordinator visibility. The prototype would not use USTA data to identify individuals, make eligibility decisions, or generate guaranteed predictions. USTA data would not be uploaded to public LLMs or tools that retain prompts/files. Any AI-supported outputs would be labeled as decision support and would include known limitations.

### Confirm submission is your own work / rights to materials

Check only if true:

`I confirm this is my own work or I have rights.`

### Current or former USTA National employee?

Answer truthfully:

`[Yes/No]`

Rules note: current USTA National employees are not eligible.

### Current or former USTA National contractor?

Answer truthfully:

`[Yes/No]`

Rules note: current USTA National vendors with active contractual relationships are not eligible.

### Affiliated with USTA Section, volunteer program, member program, sponsor, vendor, or partner?

Answer truthfully. If no formal affiliation:

> No formal affiliation. TenAceIQ received an invitation to apply after previously showing interest in USTA data.

If you have USTA membership, volunteer, section, vendor, sponsor, partner, or other affiliation, disclose it here.

### Personal/family/business/financial relationship with judge, USTA employee, IBM representative, sponsor, or committee member

Answer truthfully. If none:

`No known relationship.`

### Are all team members 18 or older?

Answer truthfully:

`[Yes/No]`

### Legally allowed to participate in U.S.-based challenge with cash prize?

Answer truthfully:

`[Yes/No]`

### Are you/company/team located in the United States?

Answer truthfully:

`[Yes/No]`

### If finalist, can up to two team members attend US Open event on September 3?

Answer truthfully:

`[Yes/No]`

### Company or startup name, if applicable

Paste:

`TenAceIQ`

### Company website

Paste:

`https://www.tenaceiq.com`

### Country/state of registration, if applicable

If legally formed:

`[United States, State]`

If not legally formed:

`Not legally formed yet`

### Is your company legally formed?

Answer truthfully:

`[Yes/No]`

### Has your company worked with sports, tennis, events, AI, analytics, computer vision, or fan engagement products before?

Paste:

> Yes. TenAceIQ is a live tennis intelligence platform focused on player discovery, rankings, leagues, matchup analysis, captain workflows, League Office operations, Data Assist uploads, and role-based tennis intelligence. The product has working Player, Captain, League, Admin, and public discovery journeys with production QA evidence.

### Certification and consent checkboxes

Check only if true:

- `I certify that the information provided is accurate.`
- `I consent` to open-source identity, company, eligibility, and adverse media checks.
- `I agree` to follow all challenge rules, data handling rules, and confidentiality requirements.
- `I understand` that access to USTA data is not guaranteed and may be denied or revoked.
- `I understand` finalists and winners may need additional identity, tax, payment, travel, and contract documentation.

### Applicant Details To Fill

- Applicant name: [Your Name]
- Company/team: TenAceIQ
- Website: https://www.tenaceiq.com
- Email: [Your Email]
- Phone: [Your Phone]
- Location: [City, State]
- Product stage: Live product, launch-ready, with production QA evidence
- Requested USTA relationship: data access pathway, pilot feedback, and finalist pitch consideration
- Focus area: Open Category - 35 Million Players by 2035
- Secondary focus area: Mission-Driven - Hyper-Personalized Player Experiences
- Anticipated USTA data: anonymized or aggregated player, facility, historical play, ranking, match statistic, schedule, result, and competition context made available by USTA to qualified teams
- Anticipated non-USTA data: TenAceIQ product data, user-provided match context, TennisLink exports where users have rights to provide them, public tennis context, optional weather/location context if useful and properly licensed

If the form asks whether this is an idea or existing product, use:

> Existing product. TenAceIQ is live and has working public discovery, Player, Captain, League Office, Data Assist, and admin review workflows. The USTA Connect opportunity would help validate and scale the league-data-to-decisions layer with better data access, ecosystem feedback, and pilot opportunities.

### Project Name

TenAceIQ

Optional submission title:

> TenAceIQ: USTA League Intelligence for Players, Captains, and Coordinators

### One-Line Description

TenAceIQ turns tennis league data into match prep, lineup decisions, standings, and trusted league operations for players, captains, and coordinators.

### Short Summary

TenAceIQ is a tennis intelligence platform that helps the USTA league ecosystem move from scattered data to better decisions. Players can explore public tennis context, personalize My Lab, and prepare for matchups. Captains can manage availability, compare lineups, scout opponents, and send clearer team briefs. League coordinators can organize players or teams, schedules, results, standings, and public league visibility with review-first data workflows.

### Focus Area Alignment

TenAceIQ is best aligned to the Open Category: 35 Million Players by 2035.

To reach and retain more players, tennis needs participation experiences that feel easier, clearer, and more personally useful. TenAceIQ supports that mission by helping league players know what is happening, prepare for matches, understand their tennis context, and stay connected to teams, captains, and seasons. It also reduces the operational friction on captains and coordinators, two groups that heavily influence whether league play feels organized enough for people to return.

TenAceIQ also fits the Mission-Driven personalized player experience category because My Lab and Matchup turn player and competition context into individualized prep, training focus, and next actions.

### Problem

USTA league tennis creates a large amount of useful data, but the people closest to the court often cannot turn it into action quickly.

Players want to know who they are playing, what the matchup suggests, and what to work on next. Captains need to decide who is available, which lineups make sense, how pairings compare, and what message to send before match day. Coordinators need to manage schedules, results, standings, and member visibility without relying on scattered spreadsheets, emails, texts, and manual cleanup.

The result is not a lack of tennis data. The gap is that the data is not shaped around the decisions each role has to make.

### Solution

TenAceIQ organizes tennis intelligence by role.

Free users can explore players, teams, leagues, rankings, and public tennis context. Player users unlock My Lab, follows, matchup insight, and a player-linked personalized experience. Captains get Player features plus Team Hub tools for availability, lineups, scouting, readiness, and weekly team decisions. League coordinators get League Office tools for structure, schedules, scores, standings, visibility, and admin workflows.

The platform uses Data Assist to accept TennisLink exports and user, captain, or coordinator-provided match data. Uploads can be reviewed before they affect trusted records, so the product supports practical tennis intelligence without overclaiming data certainty.

### Who It Serves

Primary users:

- USTA league players who want better matchup prep and player development context
- USTA team captains who manage weekly availability, lineups, scouting, and team communication
- League coordinators and admins who run seasons, results, standings, and public/member league visibility

Secondary users:

- Coaches helping players connect match evidence to training focus
- Clubs and organizers running ladders, events, and internal competition

### Use of USTA Data

TenAceIQ is designed to use USTA league context responsibly: player records, teams, leagues, facilities, schedules, scorecards, results, standings, ratings, rankings, match statistics, and public competition context where access is approved, USTA-provided for the contest, aggregated/anonymized, or user-provided with appropriate rights.

The platform already supports a review-first Data Assist flow for TennisLink exports such as scorecards, schedules, and team summaries. This lets the product convert league records into useful role-specific workflows while keeping trust checks visible.

With a formal USTA data pathway, TenAceIQ could reduce manual upload friction and improve freshness, coverage, and confidence across player, captain, and coordinator workflows.

### Innovation

Most tennis products either show raw data or manage one narrow workflow. TenAceIQ connects the data to the role-specific decision:

- Player: "What does this matchup mean, and what should I work on?"
- Captain: "Who can play, what lineup gives us the best chance, and what do I need to send?"
- Coordinator: "How do I keep structure, schedules, results, standings, and visibility moving?"

The innovation is the role-based intelligence layer on top of tennis participation data: discovery, matchup prep, lineup strategy, review-first imports, public league context, and coordinator operations working together.

### Impact

TenAceIQ can help USTA increase the value of league participation by making data more useful to the people who keep leagues alive.

Potential impact:

- Players get clearer prep and development cues.
- Captains spend less time chasing information and more time leading teams.
- Coordinators reduce spreadsheet cleanup and support more transparent seasons.
- USTA gains a stronger data-to-engagement loop around league play.
- Better match-week clarity can increase retention, satisfaction, and participation.
- Reduced captain/coordinator friction supports the USTA goal of reaching 35 million players by making league play easier to start, manage, and continue.

### Feasibility and Current Status

TenAceIQ is not just an idea. The platform is live at:

https://www.tenaceiq.com

Current working areas include:

- Public tennis discovery for players, teams, leagues, rankings, and context
- My Lab for player-linked personalization and next tennis actions
- Matchup prep for player comparison and match planning
- Captain workflows for availability, lineup thinking, projection, messaging, and team briefs
- League Office workflows for league setup, results, standings, public visibility, and coordinator tools
- Data Assist for review-first upload workflows
- Admin review and access tools for data trust and entitlement management

Recent launch readiness notes:

- Customer journeys signed off: 9/9
- Tier features with pass evidence: 15/15
- Open product blockers: 0
- Open p0/p1 rows: 0
- Production domain: https://www.tenaceiq.com

### Why TenAceIQ Should Be Selected

TenAceIQ is aligned with the USTA Connect Innovation Challenge because it uses tennis data to improve the real day-to-day experience of the sport.

It does not treat data as a static leaderboard. It turns data into the next useful action: a player preparing for an opponent, a captain choosing a lineup, or a coordinator keeping a season moving. The platform is already built around the people who make league tennis work, and a stronger USTA data connection would make the product more accurate, timely, and valuable for the broader tennis ecosystem.

TenAceIQ should score well against the published judging criteria:

- Impact: directly supports participation, retention, and league experience quality for players, captains, and coordinators.
- Innovation: turns tennis data into role-specific decisions instead of another generic dashboard.
- Feasibility: live platform, existing workflows, production QA evidence, and a clear contest-data isolation plan.

## 100-Word Version

TenAceIQ turns tennis league data into practical decisions for players, captains, and coordinators. Players can explore tennis context, personalize My Lab, and prepare for matchups. Captains can manage availability, compare lineups, scout opponents, and send clearer team briefs. Coordinators can organize schedules, results, standings, and visibility with review-first data workflows. Built for the USTA mission of reaching 35 million players by 2035, TenAceIQ helps the tennis community spend less time searching, guessing, and coordinating, and more time playing.

## 250-Word Version

TenAceIQ is a tennis intelligence platform built around the real decisions that shape USTA league tennis.

Today, players, captains, and coordinators have access to more tennis data than ever, but much of it still lives in scattered schedules, scorecards, standings, team pages, texts, spreadsheets, and exports. The problem is not simply finding data. The problem is turning it into a useful next action.

TenAceIQ organizes that intelligence by role. Free users can explore players, teams, leagues, rankings, and public tennis context. Players can unlock My Lab, follows, matchup insight, and a personalized experience linked to their tennis identity. Captains can use Team Hub tools for availability, lineups, scouting, readiness, and weekly team decisions. League coordinators can use League Office tools for league structure, schedules, results, standings, visibility, and admin workflows.

The platform is designed to work with approved USTA data access, TennisLink exports, and user, captain, or coordinator-provided match data. Its Data Assist workflow supports review-first imports for scorecards, schedules, and team summaries before trusted records are updated.

TenAceIQ is already live at https://www.tenaceiq.com, with launch-ready product surfaces and signed-off customer journeys across Player, Coach, Captain, League, Full-Court, Admin, and public discovery flows.

With contest-provided USTA datasets and ecosystem support, TenAceIQ could help league players prepare better, captains make clearer weekly decisions, coordinators reduce manual cleanup, and USTA turn participation data into a stronger engagement loop.

## Decisive Round Plan If Selected

Required by the rules:

- Working prototype or proof of concept: hosted instance, executable demo, or repo with build instructions.
- Written overview: up to five pages or equivalent.
- SBOM for the prototype.
- 3-5 minute demo video or narrated walkthrough.
- Disclosures: open-source software/licenses, third-party IP, datasets, known limitations, and risks.

Recommended TenAceIQ decisive-round build:

> USTA League Mission Control: a contest-data prototype showing how anonymized or aggregated USTA league data can power player prep, captain decisions, and coordinator visibility.

Prototype scope:

- Import/sample USTA-provided anonymized or aggregated contest data into an isolated contest workspace.
- Map available fields into TenAceIQ role surfaces.
- Show one end-to-end path: league context -> player/matchup insight -> captain lineup/readiness -> coordinator/public visibility.
- Include a privacy/security page explaining data boundaries, no re-identification, and deletion plan.
- Keep production TenAceIQ data separate from USTA contest data unless separately authorized.

Written overview outline:

1. Problem and USTA mission impact
2. User roles and decision moments
3. Data sources and permitted use
4. Prototype architecture and privacy/security controls
5. Demo flow, limitations, and roadmap

SBOM approach:

- Generate dependency inventory from `package-lock.json`.
- Include major runtime/dependency categories: Next.js, React, Supabase client/server libraries, Stripe if present but not part of contest flow, testing/build tooling, OCR/parser dependencies if used.
- Disclose open-source licenses and any third-party datasets/assets used in the contest prototype.

Known limitations to disclose honestly:

- Data quality depends on available USTA contest datasets and permitted fields.
- Any predictive or recommendation feature should be positioned as decision support, not a guarantee.
- USTA-provided anonymized/aggregated data must remain contest-scoped unless a separate production agreement is reached.
- Data Assist is review-first and should not be described as automatic trusted ingestion.

## Demo Flow

Recommended 5-minute demo:

1. Public discovery
   - Start on TenAceIQ public search or Explore.
   - Show that a visitor can find players, teams, leagues, rankings, or league context.
   - Message: "This is the free tennis landscape."

2. Player intelligence
   - Open My Lab or Matchup.
   - Show player-linked context, matchup prep, or next tennis action.
   - Message: "Players do not just need records. They need a read before they play."

3. Captain match week
   - Open Captain or Team Hub.
   - Show availability, lineup option, projection, and team brief.
   - Message: "Captains turn the same tennis context into who plays, where, and what gets sent."

4. League Office
   - Open League Coordinator or public league context.
   - Show structure, results, standings, and source-to-public flow.
   - Message: "Coordinators keep the season moving while members see the right public context."

5. Data trust
   - Open Data Assist.
   - Show review-first upload positioning.
   - Message: "Uploads and exports can refresh tennis context only after review checks."

Close:

> TenAceIQ helps USTA league data become useful at the exact point of decision: the player preparing, the captain choosing, and the coordinator running the season.

Recommended link strategy:

- Public product link: https://www.tenaceiq.com
- Do not include private fixture credentials in the form.
- If the form allows a note, offer to provide a guided demo or temporary judge-access account after official review terms are clear.

## Suggested Screenshots

Use 3 to 5 screenshots, ideally:

- Public discovery: Explore, league directory, player/team search, or rankings
- Player: My Lab or Matchup
- Captain: availability, lineup, projection, or team brief
- League: League Office or public league standings/result context
- Data Assist: review-first upload/import screen

Existing evidence paths that may help:

- `docs/qa-evidence/2026-06-29/day5/2026-06-29-day5-free-public-discovery-explore-route-desktop-codex.png`
- `docs/qa-evidence/2026-06-29/day2/2026-06-29-day2-player-my-lab-return-state-linked-profile-state-desktop-codex.png`
- `docs/qa-evidence/2026-06-29/day3/2026-06-29-day3-captain-week-flow-team-brief-desktop-codex.png`
- `docs/qa-evidence/2026-06-29/day4/2026-06-29-day4-league-result-to-public-context-public-league-page-desktop-codex.png`
- `docs/qa-evidence/2026-06-29/day5/2026-06-29-day5-free-public-discovery-data-assist-review-first-handoff-cue-desktop-codex.png`

## 60-Second Video Script

TenAceIQ helps USTA league tennis move from scattered data to better decisions.

Players can explore the tennis landscape, connect their identity, and use My Lab and Matchup to understand what matters before they play.

Captains can move from availability to lineup choices, compare team scenarios, and send a clearer team brief before match day.

League coordinators can manage structure, results, standings, and member-facing visibility without rebuilding the season in spreadsheets.

Data Assist supports TennisLink exports and user-provided match records through review-first workflows, so trusted tennis context can improve over time.

The opportunity is simple: USTA data becomes more valuable when it helps each person act. TenAceIQ turns league data into practical intelligence for players, captains, and coordinators.

## Pitch Deck Outline

Slide 1: TenAceIQ

- USTA League Intelligence for Players, Captains, and Coordinators
- More Tennis. Less Chaos.

Slide 2: The Problem

- League data exists, but decisions are scattered.
- Players guess.
- Captains chase.
- Coordinators clean up.
- Friction hurts retention and slows the path to 35 million players.

Slide 3: The Product

- Explore
- My Lab and Matchup
- Team Hub
- League Office
- Data Assist

Slide 4: How USTA Data Powers It

- Player records
- Teams and leagues
- Schedules
- Scorecards and results
- Standings and rankings
- Review-first trust layer

Slide 5: Demo Story

- Find the context.
- Prep the player.
- Build the lineup.
- Publish league clarity.

Slide 6: Impact

- Better player prep
- Faster captain decisions
- Cleaner coordinator workflows
- Stronger USTA engagement loop
- More players returning to organized tennis because league play feels easier to understand and manage

Slide 7: Why Now

- TenAceIQ is live.
- Role journeys are built and tested.
- Contest-provided USTA data can unlock scale, freshness, and credibility in a controlled prototype.

Slide 8: Ask

- Select TenAceIQ for the finalist pitch.
- Explore USTA data access, pilot opportunities, and captain/coordinator feedback.
- Confirm the safest path from contest prototype to pilot if USTA sees strategic fit.

## Email Reply to USTA Contact

Subject: Re: USTA Connect Innovation Challenge

Hi Zachary,

Thank you for sending this over. I am planning to submit TenAceIQ for the USTA Connect Innovation Challenge.

TenAceIQ is a tennis intelligence platform focused on turning league data into practical decisions for players, captains, and coordinators. The strongest fit for the challenge is our USTA league intelligence workflow: player discovery and matchup prep, captain availability and lineup tools, League Office workflows for schedules/results/standings, and review-first Data Assist uploads for TennisLink exports and user-provided match records.

I appreciate the invitation and will review the official rules before submitting the entry form by July 3.

Best,

[Your Name]

## Final Submission Checklist

- Read official rules before submitting.
- Confirm the applicant/company name and contact email.
- Confirm eligibility: not a current USTA National employee and not a current USTA National vendor with an active contractual relationship.
- Confirm whether the form allows attachments, links, or video.
- Identify focus area as Open Category - 35 Million Players by 2035.
- Mention secondary alignment to Mission-Driven personalized player experiences if the form allows more than one focus area.
- Identify anticipated USTA and non-USTA data sources.
- Use https://www.tenaceiq.com as the live product link.
- Include 3 to 5 screenshots if attachments are allowed.
- Keep the story focused on USTA league data to decisions.
- Use "approved USTA data access, TennisLink exports, and user-provided data" language.
- Avoid claims of official USTA integration unless formalized.
- Submit before July 3, 2026.

## If TenAceIQ Advances

Immediate actions after notification:

- Complete security and identity checks quickly.
- Confirm every named team member who can access USTA contest data.
- Create the isolated contest workspace before downloading or querying USTA data.
- Start an SBOM and disclosure file on day one.
- Keep a written data inventory and deletion log.
- Build toward the August 9 decisive-round deadline, not the September showcase.
- Prepare a five-minute finalist pitch only after the decisive-round package is submitted.
