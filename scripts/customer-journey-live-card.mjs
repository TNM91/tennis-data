const options = parseArgs(process.argv.slice(2))
const rawQuery = options.query.trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)

const resultsPath = 'docs/customer-journey-test-results.md'

const tierLabels = {
  free: 'Free',
  player_plus: 'Player+',
  coach: 'Coach',
  captain: 'Captain',
  league: 'TIQ League Coordinator/Admin',
  full_court: 'Full-Court',
  admin_internal: 'Admin/Internal',
}

const sessions = {
  day1: 'Day 1 - Trust Loop',
  day2: 'Day 2 - Player And Coach Depth',
  day3: 'Day 3 - Captain Week',
  day4: 'Day 4 - League And Admin',
  day5: 'Day 5 - Full-Court And Free/Public Regression',
}

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    session: 'day1',
    tierId: 'player_plus',
    risk: 'critical',
    personaFixture: 'player_plus_linked',
    fixtureIds: ['player_plus_linked', 'level-up-completion'],
    entryRoute: '/player-development/relentless-competitor-4-0/level-up',
    task: 'Start Level Up on a phone-width screen, choose useful work, complete proof, and confirm the next action is obvious.',
    pass: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
    failFast: ['too much scroll before action', 'local proof presented as synced', 'generic drill copy', 'missing next action'],
    evidence: ['active-card', 'saved-proof-status', 'next-recommendation', 'tiny-note-behavior'],
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    session: 'day1',
    tierId: 'coach',
    risk: 'critical',
    personaFixture: 'coach_primary',
    fixtureIds: ['coach_primary', 'player_plus_linked', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
    entryRoute: '/coach',
    task: 'Create or inspect a coach-player link, assign one useful tool, complete it as the player, then verify coach review.',
    pass: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
    failFast: ['assignment visible to wrong player', 'proof only local when UI says synced', 'coach cannot find proof', 'no next lesson handoff'],
    evidence: ['invite-link-state', 'assignment-card', 'player-challenge-screen', 'coach-review-proof'],
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    session: 'day2',
    tierId: 'coach',
    risk: 'high',
    personaFixture: 'coach_primary',
    fixtureIds: ['coach_primary', 'linked-player-profile', 'level-up-assignment'],
    entryRoute: '/player-development/relentless-competitor-4-0/coach-planner',
    task: 'Use identity, readiness, and assigned work to shape a one-hour lesson plan that supports the player path.',
    pass: 'The planner is coach-facing, practical, and connected to the player Level Up path.',
    failFast: ['player-facing workbook copy', 'lesson plan feels disconnected from Level Up', 'no assignment handoff'],
    evidence: ['planner-identity', 'warm-up-block', 'skill-block', 'pressure-block', 'assignment-handoff'],
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    session: 'day2',
    tierId: 'player_plus',
    risk: 'high',
    personaFixture: 'player_plus_linked',
    fixtureIds: ['player_plus_linked', 'linked-player-profile'],
    entryRoute: '/mylab',
    task: 'Return to My Lab after activity and confirm personal context, linked profile, and next useful action survive refresh.',
    pass: 'My Lab makes the player identity, linked profile, and next action clear after refresh.',
    failFast: ['generic empty dashboard', 'linked player unclear', 'next action missing', 'stale upgrade lock'],
    evidence: ['linked-profile-state', 'identity-signal', 'next-action', 'post-refresh-state'],
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    session: 'day3',
    tierId: 'captain',
    risk: 'high',
    personaFixture: 'captain_primary',
    fixtureIds: ['captain_primary', 'captain-team-week'],
    entryRoute: '/captain',
    task: 'Move from availability and scouting context to lineup choice and one team-facing update.',
    pass: 'Captain can make a weekly decision and produce a useful team-facing update.',
    failFast: ['availability disconnected from lineup', 'projection unclear', 'message/brief dead end', 'Captain tier copy missing'],
    evidence: ['availability-state', 'lineup-option', 'projection-scenario-result', 'team-brief-or-message'],
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    session: 'day4',
    tierId: 'league',
    risk: 'high',
    personaFixture: 'league_coordinator',
    fixtureIds: ['league_coordinator', 'league-week'],
    entryRoute: '/league-coordinator',
    task: 'Record or review a league result and verify the intended public/member context changes without private controls leaking.',
    pass: 'Coordinator operation and member-facing league context stay connected without exposing private controls.',
    failFast: ['result does not propagate', 'private controls visible publicly', 'standings context missing', 'fixture data unsafe'],
    evidence: ['result-fixture', 'coordinator-source-screen', 'public-league-screen', 'privacy-check'],
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    session: 'day5',
    tierId: 'full_court',
    risk: 'medium',
    personaFixture: 'full_court_operator',
    fixtureIds: ['full_court_operator', 'full-court-access-state'],
    entryRoute: '/pricing',
    task: 'Move across Player, Coach, Captain, and League surfaces with one multi-role account and check for stale locks.',
    pass: 'All paid workspaces open cleanly and the user can tell which workspace fits the job.',
    failFast: ['paid workspace locked', 'redundant upgrade prompt', 'role navigation confusing'],
    evidence: ['pricing-tier-copy', 'player-workspace', 'coach-workspace', 'captain-workspace', 'league-workspace'],
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    session: 'day4',
    tierId: 'admin_internal',
    risk: 'high',
    personaFixture: 'admin_test',
    fixtureIds: ['admin_test', 'admin-access-repair', 'data-assist-upload'],
    entryRoute: '/admin/access',
    task: 'Repair access or inspect data quality using only safe test fixtures, then confirm affected product surfaces update.',
    pass: 'Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces.',
    failFast: ['test data not isolated', 'access change not reflected', 'unreviewed data treated as trusted', 'no rollback note'],
    evidence: ['test-profile', 'starting-access', 'target-access', 'import-review-status', 'affected-surface'],
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    session: 'day5',
    tierId: 'free',
    risk: 'medium',
    personaFixture: 'free_viewer',
    fixtureIds: ['free_viewer', 'data-assist-upload'],
    entryRoute: '/explore',
    task: 'Browse public tennis intelligence first, then check that upgrade and Data Assist paths are clear and honest.',
    pass: 'Public tennis intelligence is visible first, and upgrade/data-assist paths are clear.',
    failFast: ['upgrade prompt appears before useful context', 'public detail unavailable', 'Data Assist implies instant trusted data'],
    evidence: ['explore-route', 'public-detail-page', 'pricing-handoff', 'data-assist-review-language'],
  },
]

console.log('TenAceIQ Live Journey Test Card')
console.log('')
console.log('Use this for one active manual pass: route, task, evidence filenames, ledger row, and blocked-state commands.')
console.log('')

const matches = getMatches()

if (!matches.length) {
  if (rawQuery) {
    console.log(`No journey matched "${rawQuery}".`)
    console.log('')
  }
  printList()
  process.exit(rawQuery ? 1 : 0)
}

if (matches.length > 1) {
  console.log(`Matched ${matches.length} journeys for "${rawQuery}":`)
  console.log('')
  for (const journey of matches) {
    console.log(`- ${journey.id} (${tierLabels[journey.tierId]}, ${journey.session})`)
    console.log(`  Route: ${journey.entryRoute}`)
  }
  console.log('')
  console.log('Run again with a specific journey id for the one-screen live test card.')
  process.exit(0)
}

printLiveCard(matches[0])

function printLiveCard(journey) {
  const defaults = {
    date: options.date || 'yyyy-mm-dd',
    tester: options.tester || '<tester>',
    deviceBrowser: options.deviceBrowser || '<device/browser>',
  }
  const evidenceFolder = `docs/qa-evidence/${defaults.date}/${journey.session}`
  const evidenceFiles = journey.evidence.map((item) => `${defaults.date}-${journey.session}-${journey.id}-${item}-${slug(defaults.deviceBrowser)}-${slug(defaults.tester)}.png`)

  console.log(`${journey.label} (${journey.id})`)
  console.log(`Session: ${sessions[journey.session]} | Tier: ${tierLabels[journey.tierId]} | Risk: ${journey.risk}`)
  console.log(`Account fixture: ${journey.personaFixture}`)
  console.log(`Data fixtures: ${journey.fixtureIds.join(', ')}`)
  console.log(`Open: ${journey.entryRoute}`)
  console.log('')
  console.log('Do this:')
  console.log(`- ${journey.task}`)
  console.log('')
  console.log('Pass means:')
  console.log(`- ${journey.pass}`)
  console.log('')
  console.log('Stop and log an issue if:')
  for (const signal of journey.failFast) console.log(`- ${signal}`)
  console.log('')
  console.log('Capture:')
  console.log(`Folder: ${evidenceFolder}`)
  for (const file of evidenceFiles) console.log(`- ${file}`)
  console.log('')
  console.log('Paste-ready ledger row:')
  console.log('| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |')
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  console.log(
    `| ${formatCell(defaults.date)} | ${formatCell(defaults.tester)} | ${formatCell(defaults.deviceBrowser)} | ${journey.personaFixture} | ${journey.id} | ${journey.entryRoute} | needs-follow-up |  |  | ${evidenceFiles.join('; ')} |  |  |`
  )
  console.log('')
  console.log('If blocked:')
  console.log('- fixture missing: set Category `fixture-gap`, run `npm run qa:fixture-review -- ' + journey.personaFixture + '`, then rerun this card.')
  console.log('- wrong tier access: set Category `access-gap` or `gating-gap`, run `npm run qa:access-review -- ' + journey.tierId + '`.')
  console.log('- page loads but does not solve the job: run `npm run qa:route-review -- ' + journey.entryRoute + '` and log the product gap.')
  console.log('')
  console.log('Close with:')
  console.log('- npm run qa:ledger-check')
  console.log(`- npm run qa:session-status -- ${journey.session}`)
  console.log(`- npm run qa:retest -- ${journey.id}`)
  console.log('')
  console.log(`Closeout rule: this live card is not done until ${resultsPath} has a real row and the evidence proves the pass signal.`)
}

function getMatches() {
  if (!rawQuery) return []

  const exact = journeys.find((journey) => journey.id === normalizedQuery || normalize(journey.label) === normalizedQuery)
  if (exact) return [exact]

  const tierId = Object.entries(tierLabels).find(([id, label]) => normalize(id) === normalizedQuery || normalize(label) === normalizedQuery)?.[0]
  if (tierId) return journeys.filter((journey) => journey.tierId === tierId)

  return journeys.filter((journey) => searchableText(journey).includes(rawQuery) || searchableText(journey).includes(normalizedQuery))
}

function printList() {
  console.log('Usage: npm run qa:live-card -- <journey-id | tier | search> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>')
  console.log('')
  console.log('Available live cards:')
  for (const journey of journeys) {
    console.log(`- ${journey.id} (${tierLabels[journey.tierId]}, ${journey.session})`)
  }
}

function searchableText(journey) {
  return [
    journey.id,
    journey.label,
    journey.session,
    journey.tierId,
    tierLabels[journey.tierId],
    journey.risk,
    journey.personaFixture,
    journey.entryRoute,
    journey.task,
    journey.pass,
    ...journey.fixtureIds,
    ...journey.failFast,
    ...journey.evidence,
  ]
    .join(' ')
    .toLowerCase()
}

function parseArgs(args) {
  const parsed = {
    query: '',
    date: '',
    tester: '',
    deviceBrowser: '',
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? ''

    if (!arg.startsWith('--')) {
      parsed.query = [parsed.query, arg].filter(Boolean).join(' ')
      continue
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=')
    const key = rawKey.trim().toLowerCase()
    const nextValue = args[index + 1] ?? ''
    const value = inlineValue ?? (nextValue.startsWith('--') ? '' : nextValue)

    if (inlineValue === undefined && value) index += 1

    if (key === 'date') parsed.date = value
    if (key === 'tester') parsed.tester = value
    if (key === 'device' || key === 'browser' || key === 'device-browser') parsed.deviceBrowser = value
  }

  return parsed
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function slug(value) {
  return normalize(value || 'device')
}

function formatCell(value) {
  return value.trim().replace(/\|/g, '/')
}
