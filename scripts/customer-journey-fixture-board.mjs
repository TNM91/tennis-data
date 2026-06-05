import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const fixturesPath = 'docs/customer-journey-test-fixtures.md'
const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()

const fixtureGroups = [
  {
    id: 'account-access',
    label: 'Account access',
    fixtures: ['admin_test', 'player_plus_linked', 'coach_primary', 'captain_primary', 'league_coordinator', 'full_court_operator', 'free_viewer'],
    closeout: 'Correct role can reach the expected workspace and lower tiers do not see protected controls.',
  },
  {
    id: 'player-coach-link',
    label: 'Player and coach link',
    fixtures: ['linked-player-profile', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
    closeout: 'Coach can invite/assign, player can complete proof, and coach can review the signal.',
  },
  {
    id: 'team-league-data',
    label: 'Team and league data',
    fixtures: ['captain-team-week', 'league-week'],
    closeout: 'Captain and coordinator tests use safe, repeatable roster/schedule/result data.',
  },
  {
    id: 'admin-data-safety',
    label: 'Admin and data safety',
    fixtures: ['admin-access-repair', 'data-assist-upload', 'full-court-access-state'],
    closeout: 'Access repair, imports, and all-workspace checks are reversible and safe for repo history.',
  },
]

const fixtures = [
  { id: 'free_viewer', type: 'account', role: 'Free / public', setup: 'Signed-out or basic account can use public discovery and Data Assist entry.' },
  { id: 'player_plus_linked', type: 'account', role: 'Player', setup: 'Player access, linked profile, Level Up local/completion state.' },
  { id: 'coach_primary', type: 'account', role: 'Coach', setup: 'Coach access, student list, invite, assign, and review ability.' },
  { id: 'captain_primary', type: 'account', role: 'Captain', setup: 'Captain access plus a safe team-week fixture.' },
  { id: 'league_coordinator', type: 'account', role: 'League', setup: 'Coordinator access plus a safe league-week fixture.' },
  { id: 'full_court_operator', type: 'account', role: 'Full-Court', setup: 'All paid workspaces unlocked with no stale upgrade locks.' },
  { id: 'admin_test', type: 'account', role: 'Admin/Internal', setup: 'Admin access limited to safe test profiles and import fixtures.' },
  { id: 'linked-player-profile', type: 'data', role: 'Player profile', setup: 'Player profile, identity slug, and recent context if available.' },
  { id: 'coach-invite-token', type: 'data', role: 'Coach invite', setup: 'Fresh disposable invite token with expected coach and player.' },
  { id: 'level-up-assignment', type: 'data', role: 'Level Up assignment', setup: 'One card/module assignment, due date, coach note, and proof requirement.' },
  { id: 'level-up-completion', type: 'data', role: 'Level Up completion', setup: 'Proof rating, tiny note, completed date, and optional assignment link.' },
  { id: 'captain-team-week', type: 'data', role: 'Captain team week', setup: 'Team roster, availability states, opponent/context, and lineup scenario.' },
  { id: 'league-week', type: 'data', role: 'League week', setup: 'League, participants, schedule, result fixture, standings/public expectation.' },
  { id: 'data-assist-upload', type: 'data', role: 'Data Assist upload', setup: 'Safe scorecard or schedule fixture with expected review status.' },
  { id: 'full-court-access-state', type: 'data', role: 'Full-Court access', setup: 'One account with every paid workspace and no stale upgrade locks.' },
  { id: 'admin-access-repair', type: 'data', role: 'Admin access repair', setup: 'Test profile, starting access, target access, and rollback note.' },
]

const journeys = [
  { id: 'player-level-up-mobile-loop', session: 'day1', fixtures: ['player_plus_linked', 'level-up-completion'] },
  { id: 'coach-player-assigned-challenge', session: 'day1', fixtures: ['coach_primary', 'player_plus_linked', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'] },
  { id: 'coach-lesson-support', session: 'day2', fixtures: ['coach_primary', 'linked-player-profile', 'level-up-assignment'] },
  { id: 'player-my-lab-return-state', session: 'day2', fixtures: ['player_plus_linked', 'linked-player-profile'] },
  { id: 'captain-week-flow', session: 'day3', fixtures: ['captain_primary', 'captain-team-week'] },
  { id: 'league-result-to-public-context', session: 'day4', fixtures: ['league_coordinator', 'league-week'] },
  { id: 'admin-access-and-data-quality', session: 'day4', fixtures: ['admin_test', 'admin-access-repair', 'data-assist-upload'] },
  { id: 'full-court-access-pass', session: 'day5', fixtures: ['full_court_operator', 'full-court-access-state'] },
  { id: 'free-public-discovery', session: 'day5', fixtures: ['free_viewer', 'data-assist-upload'] },
]

const rows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)

const selectedGroups = fixtureGroups.filter(matchesGroup)

console.log('TenAceIQ Fixture Readiness Board')
console.log('')
console.log(`Sources: ${fixturesPath}; ${resultsPath}`)
console.log('Use this before test week or a daily block to confirm account access, player/coach links, safe data fixtures, dependent journeys, and fixture-gap rows.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!selectedGroups.length) {
  console.log(`No fixture group matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:fixture-board -- <group | fixture | day1-day5 | journey | account | data>')
  process.exit(1)
}

for (const group of selectedGroups) printGroup(group)

console.log('Use with:')
console.log('- npm run qa:fixtures')
console.log('- npm run qa:fixture-status -- <day1-day5>')
console.log('- npm run qa:fixture-review -- <fixture>')
console.log('- npm run qa:tester-packet -- <day1-day5> --device=<phone|tablet|desktop>')
console.log('- npm run qa:ledger-check')
console.log('')
console.log('Fixture board rule: fixtures are not considered ready from memory. Confirm access/data shape before the browser pass, log fixture-gap when setup is missing, then rerun the dependent journey after repair.')

function printGroup(group) {
  const groupFixtures = group.fixtures.map((fixtureId) => fixtures.find((fixture) => fixture.id === fixtureId)).filter(Boolean)
  const dependentJourneys = journeys.filter((journey) => journey.fixtures.some((fixtureId) => group.fixtures.includes(fixtureId)))
  const fixtureGapRows = rows.filter((row) => row.result !== 'pass' && row.category === 'fixture-gap' && dependentJourneys.some((journey) => journey.id === row.journeyId))

  console.log(`${group.label} (${group.id})`)
  console.log(`  Closeout: ${group.closeout}`)
  console.log(`  Fixtures: ${groupFixtures.length}; dependent journeys: ${dependentJourneys.length}; open fixture-gap rows: ${fixtureGapRows.length}`)
  console.log('  Fixtures to confirm:')

  for (const fixture of groupFixtures) {
    const dependent = journeys.filter((journey) => journey.fixtures.includes(fixture.id))
    const seenRows = rows.filter((row) => row.accountFixture === fixture.id || row.notes.includes(fixture.id) || row.nextAction.includes(fixture.id))
    const openFixtureGap = seenRows.some((row) => row.result !== 'pass' && row.category === 'fixture-gap')
    const state = openFixtureGap ? 'open fixture-gap' : seenRows.length ? 'seen in ledger' : 'confirm before test'

    console.log(`  - ${state}: ${fixture.id} (${fixture.type}; ${fixture.role})`)
    console.log(`    Setup: ${fixture.setup}`)
    console.log(`    Dependent: ${dependent.map((journey) => journey.id).join(', ') || 'none listed'}`)
    console.log(`    Review: npm run qa:fixture-review -- ${fixture.id}`)
  }

  console.log('  Dependent journeys:')
  for (const journey of dependentJourneys) {
    const journeyRows = rows.filter((row) => row.journeyId === journey.id)
    const latestRow = journeyRows.at(-1)
    const state = latestRow ? `${latestRow.result || 'logged'}${latestRow.category ? `/${latestRow.category}` : ''}` : 'missing result'
    console.log(`  - ${state}: ${journey.id} (${journey.session})`)
    console.log(`    Fixtures: ${journey.fixtures.join(', ')}`)
    console.log(`    Next: npm run qa:journey -- ${journey.id}`)
  }

  if (fixtureGapRows.length) {
    console.log('  Open fixture-gap rows:')
    for (const row of fixtureGapRows) {
      console.log(`  - ${row.journeyId}: ${row.notes || 'missing notes'}`)
      console.log(`    Next: ${row.nextAction || 'npm run qa:fixture-review -- <fixture>'}`)
    }
  }

  console.log('')
}

function matchesGroup(group) {
  if (!rawQuery) return true

  const groupFixtures = group.fixtures.map((fixtureId) => fixtures.find((fixture) => fixture.id === fixtureId)).filter(Boolean)
  const dependentJourneys = journeys.filter((journey) => journey.fixtures.some((fixtureId) => group.fixtures.includes(fixtureId)))
  const haystack = [
    group.id,
    group.label,
    group.closeout,
    ...groupFixtures.flatMap((fixture) => [fixture.id, fixture.type, fixture.role, fixture.setup]),
    ...dependentJourneys.flatMap((journey) => [journey.id, journey.session, ...journey.fixtures]),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(rawQuery)
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
