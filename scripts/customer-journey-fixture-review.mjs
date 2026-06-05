import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const fixturesPath = 'docs/customer-journey-test-fixtures.md'
const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)

const fixtures = [
  {
    id: 'free_viewer',
    type: 'account',
    role: 'Free / signed out or basic account',
    purpose: 'Public discovery and upgrade path',
    requiredAccess: 'Public Explore, players, teams, leagues, rankings, Data Assist entry',
    setup: 'Can be signed out for most tests; use a basic account only when auth entry is part of the test.',
  },
  {
    id: 'player_plus_linked',
    type: 'account',
    role: 'Player',
    purpose: 'My Lab, Level Up, player-linked return state',
    requiredAccess: 'Player access, linked player profile, Level Up local/completion state',
    setup: 'Use for Player journey and for the invited-player side of coach tests.',
  },
  {
    id: 'coach_primary',
    type: 'account',
    role: 'Coach',
    purpose: 'Coach hub, invite, assignment, review',
    requiredAccess: 'Coach access, student list, assignment ability',
    setup: 'Must be able to create an invite and see player_plus_linked after linking.',
  },
  {
    id: 'captain_primary',
    type: 'account',
    role: 'Captain',
    purpose: 'Captain week flow',
    requiredAccess: 'Captain access plus Player access',
    setup: 'Needs a team fixture with roster, availability, and at least one lineup scenario.',
  },
  {
    id: 'league_coordinator',
    type: 'account',
    role: 'League',
    purpose: 'League Office operations',
    requiredAccess: 'League coordinator access',
    setup: 'Needs a league workspace with participants, schedule, and safe result fixture.',
  },
  {
    id: 'full_court_operator',
    type: 'account',
    role: 'Full-Court',
    purpose: 'Multi-role access pass',
    requiredAccess: 'Player, Coach, Captain, League workspaces',
    setup: 'Use to confirm no stale locks or redundant upgrade prompts across all workspaces.',
  },
  {
    id: 'admin_test',
    type: 'account',
    role: 'Admin/Internal',
    purpose: 'Access repair and data quality',
    requiredAccess: 'Admin access',
    setup: 'Use only with safe test profiles and test import fixtures.',
  },
  {
    id: 'linked-player-profile',
    type: 'data',
    role: 'Player profile fixture',
    purpose: 'Validate personalized context and coach-player link',
    requiredAccess: 'Player profile, identity slug, recent context if available',
    setup: 'Create or verify before Player and Coach depth testing.',
  },
  {
    id: 'coach-invite-token',
    type: 'data',
    role: 'Coach invite fixture',
    purpose: 'Validate coach invite to linked player',
    requiredAccess: 'Fresh invite token, expected coach id, expected player email',
    setup: 'Create fresh before the Coach-to-player assigned challenge.',
  },
  {
    id: 'level-up-assignment',
    type: 'data',
    role: 'Level Up assignment fixture',
    purpose: 'Validate assigned challenge and proof loop',
    requiredAccess: 'One card assignment, one module assignment, due date, coach note, proof requirement',
    setup: 'Create after coach/player link exists.',
  },
  {
    id: 'level-up-completion',
    type: 'data',
    role: 'Level Up completion fixture',
    purpose: 'Validate player proof and coach review',
    requiredAccess: 'Proof rating 0-5, one tiny note, completed date, assignment link when available',
    setup: 'Use for Player Level Up and Coach review evidence.',
  },
  {
    id: 'captain-team-week',
    type: 'data',
    role: 'Captain team-week fixture',
    purpose: 'Validate availability to lineup to communication',
    requiredAccess: 'Team roster, availability states, one opponent/context, one lineup scenario',
    setup: 'Create before Day 3 captain testing.',
  },
  {
    id: 'league-week',
    type: 'data',
    role: 'League week fixture',
    purpose: 'Validate coordinator result flow to public context',
    requiredAccess: 'League, teams/players, schedule, result fixture, standings/public page expectation',
    setup: 'Create before Day 4 league testing.',
  },
  {
    id: 'data-assist-upload',
    type: 'data',
    role: 'Data Assist upload fixture',
    purpose: 'Validate upload/review/import handoff',
    requiredAccess: 'Safe scorecard or schedule fixture, expected review status, expected product surface',
    setup: 'Keep file safe for repo history and admin review.',
  },
  {
    id: 'full-court-access-state',
    type: 'data',
    role: 'Full-Court access fixture',
    purpose: 'Validate all-workspace access',
    requiredAccess: 'One account with all paid workspaces and no stale upgrade locks',
    setup: 'Confirm before Day 5 access regression.',
  },
  {
    id: 'admin-access-repair',
    type: 'data',
    role: 'Admin access repair fixture',
    purpose: 'Validate entitlement changes propagate',
    requiredAccess: 'Test profile, starting access state, intended target access state, rollback note',
    setup: 'Use only with test accounts and reversible changes.',
  },
]

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    session: 'day1',
    route: '/player-development/relentless-competitor-4-0/level-up',
    fixtures: ['player_plus_linked', 'level-up-completion'],
    pass: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    session: 'day1',
    route: '/coach',
    fixtures: ['coach_primary', 'player_plus_linked', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
    pass: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    session: 'day2',
    route: '/player-development/relentless-competitor-4-0/coach-planner',
    fixtures: ['coach_primary', 'linked-player-profile', 'level-up-assignment'],
    pass: 'The planner is coach-facing, practical, and connected to the player Level Up path.',
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    session: 'day2',
    route: '/mylab',
    fixtures: ['player_plus_linked', 'linked-player-profile'],
    pass: 'My Lab makes the player identity, linked profile, and next action clear after refresh.',
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    session: 'day3',
    route: '/captain',
    fixtures: ['captain_primary', 'captain-team-week'],
    pass: 'Captain can make a weekly decision and produce a useful team-facing update.',
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    session: 'day4',
    route: '/league-coordinator',
    fixtures: ['league_coordinator', 'league-week'],
    pass: 'Coordinator operation and member-facing league context stay connected without exposing private controls.',
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    session: 'day5',
    route: '/pricing',
    fixtures: ['full_court_operator', 'full-court-access-state'],
    pass: 'All paid workspaces open cleanly and the user can tell which workspace fits the job.',
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    session: 'day4',
    route: '/admin/access',
    fixtures: ['admin_test', 'admin-access-repair', 'data-assist-upload'],
    pass: 'Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces.',
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    session: 'day5',
    route: '/explore',
    fixtures: ['free_viewer', 'data-assist-upload'],
    pass: 'Public tennis intelligence is visible first, and upgrade/data-assist paths are clear.',
  },
]

const ledgerRows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)

const matchingFixtures = fixtures.filter(matchesQuery)

console.log('TenAceIQ Fixture Review')
console.log('')
console.log(`Sources: ${fixturesPath}; ${resultsPath}`)
console.log('Use this before testing a journey to confirm the account/data fixture, dependent routes, setup note, and current evidence state.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!matchingFixtures.length) {
  console.log(`No fixture matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:fixture-review -- <fixture id | tier | journey | route | search>')
  process.exit(1)
}

for (const fixture of matchingFixtures) {
  printFixture(fixture)
}

console.log('Use with:')
console.log('- npm run qa:fixtures')
console.log('- npm run qa:journey -- <journey-id>')
console.log('- npm run qa:session-ledger -- <day1-day5>')
console.log('- npm run qa:ledger-check')
console.log('')
console.log('Closeout rule: a missing fixture is a fixture-gap, not a product pass. Create or repair the fixture, then rerun the dependent journey.')

function printFixture(fixture) {
  const dependentJourneys = journeys.filter((journey) => journey.fixtures.includes(fixture.id))

  console.log(`${fixture.id} (${fixture.type})`)
  console.log(`  Role: ${fixture.role}`)
  console.log(`  Purpose: ${fixture.purpose}`)
  console.log(`  Required access/shape: ${fixture.requiredAccess}`)
  console.log(`  Setup: ${fixture.setup}`)

  if (!dependentJourneys.length) {
    console.log('  Dependent journeys: none listed')
    console.log('')
    return
  }

  console.log('  Dependent journeys:')
  for (const journey of dependentJourneys) {
    const journeyRows = ledgerRows.filter((row) => row.journeyId === journey.id)
    const latestRow = journeyRows.at(-1)
    const marker = journeyRows.some((row) => row.result === 'pass' && row.screenshotOrVideo)
      ? 'pass logged'
      : journeyRows.length
        ? 'needs retest'
        : 'missing result'

    console.log(`  - ${marker}: ${journey.label} (${journey.id})`)
    console.log(`    Session: ${journey.session}`)
    console.log(`    Route: ${journey.route}`)
    console.log(`    Pass: ${journey.pass}`)
    console.log(`    Evidence: ${latestRow?.screenshotOrVideo || 'missing screenshot/video'}`)
    console.log(`    Command: npm run qa:journey -- ${journey.id}`)
  }

  console.log(`  Next ledger rows: ${[...new Set(dependentJourneys.map((journey) => `npm run qa:session-ledger -- ${journey.session}`))].join('; ')}`)
  console.log('')
}

function matchesQuery(fixture) {
  if (!rawQuery) return true

  const dependentJourneys = journeys.filter((journey) => journey.fixtures.includes(fixture.id))
  const haystack = [
    fixture.id,
    fixture.type,
    fixture.role,
    fixture.purpose,
    fixture.requiredAccess,
    fixture.setup,
    ...dependentJourneys.flatMap((journey) => [journey.id, journey.label, journey.session, journey.route, journey.pass]),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(rawQuery) || haystack.includes(normalizedQuery)
}

function parseMarkdownRow(line) {
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())

  return {
    date: cells[0] ?? '',
    tester: cells[1] ?? '',
    deviceBrowser: cells[2] ?? '',
    accountFixture: cells[3] ?? '',
    journeyId: cells[4] ?? '',
    entryRoute: cells[5] ?? '',
    result: cells[6] ?? '',
    category: cells[7] ?? '',
    severity: cells[8] ?? '',
    screenshotOrVideo: cells[9] ?? '',
    notes: cells[10] ?? '',
    nextAction: cells[11] ?? '',
  }
}

function normalize(value) {
  return value.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
