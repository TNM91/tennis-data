import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const fixtureGuidePath = 'docs/customer-journey-test-fixtures.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)

const fixtureLabels = {
  free_viewer: 'Free/public tester',
  player_plus_linked: 'Player+ linked account',
  coach_primary: 'Coach account',
  captain_primary: 'Captain account',
  league_coordinator: 'League coordinator account',
  full_court_operator: 'Full-Court account',
  admin_test: 'Admin test account',
  'linked-player-profile': 'Linked player profile',
  'coach-invite-token': 'Coach invite token',
  'level-up-assignment': 'Level Up assignment',
  'level-up-completion': 'Level Up completion',
  'captain-team-week': 'Captain team week',
  'league-week': 'League week',
  'data-assist-upload': 'Data Assist upload',
  'full-court-access-state': 'Full-Court access state',
  'admin-access-repair': 'Admin access repair',
}

const sessions = [
  {
    id: 'day1',
    label: 'Day 1 - Trust Loop',
    question: 'Can player proof and coach assignment close the trust loop?',
    journeys: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
  },
  {
    id: 'day2',
    label: 'Day 2 - Player And Coach Depth',
    question: 'Can recent work become a useful next lesson and player return state?',
    journeys: ['coach-lesson-support', 'player-my-lab-return-state'],
  },
  {
    id: 'day3',
    label: 'Day 3 - Captain Week',
    question: 'Can a captain move from availability to lineup to communication?',
    journeys: ['captain-week-flow'],
  },
  {
    id: 'day4',
    label: 'Day 4 - League And Admin',
    question: 'Can operations, access repair, and data review stay fixture-safe?',
    journeys: ['league-result-to-public-context', 'admin-access-and-data-quality'],
  },
  {
    id: 'day5',
    label: 'Day 5 - Full-Court And Free/Public Regression',
    question: 'Can access and public discovery work without stale locks or premature upgrade pressure?',
    journeys: ['full-court-access-pass', 'free-public-discovery'],
  },
]

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    route: '/player-development/relentless-competitor-4-0/level-up',
    fixtures: ['player_plus_linked', 'level-up-completion'],
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    route: '/coach',
    fixtures: ['coach_primary', 'player_plus_linked', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    route: '/player-development/relentless-competitor-4-0/coach-planner',
    fixtures: ['coach_primary', 'linked-player-profile', 'level-up-assignment'],
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    route: '/mylab',
    fixtures: ['player_plus_linked', 'linked-player-profile'],
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    route: '/captain',
    fixtures: ['captain_primary', 'captain-team-week'],
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    route: '/league-coordinator',
    fixtures: ['league_coordinator', 'league-week'],
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    route: '/admin/access',
    fixtures: ['admin_test', 'admin-access-repair', 'data-assist-upload'],
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    route: '/pricing',
    fixtures: ['full_court_operator', 'full-court-access-state'],
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    route: '/explore',
    fixtures: ['free_viewer', 'data-assist-upload'],
  },
]

const journeyById = new Map(journeys.map((journey) => [journey.id, journey]))
const rows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)

const filteredSessions = sessions.filter(matchesQuery)

console.log('TenAceIQ Fixture Status')
console.log('')
console.log(`Sources: ${fixtureGuidePath}; ${resultsPath}`)
console.log('Use this before a testing block to confirm required fixtures, dependent journeys, and fixture-gap blockers.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!filteredSessions.length) {
  console.log(`No session matched "${rawQuery}".`)
  console.log('Usage: npm run qa:fixture-status -- <day1-day5 | fixture | journey | route>')
  process.exit(1)
}

for (const session of filteredSessions) {
  printSession(session)
}

console.log('Use with:')
console.log('- npm run qa:fixtures')
console.log('- npm run qa:fixture-review -- <fixture>')
console.log('- npm run qa:tester-packet -- <day1-day5> --device=<phone|tablet|desktop>')
console.log('- npm run qa:issue')
console.log('- npm run qa:retest -- <day-or-journey>')
console.log('')
console.log('Closeout rule: a missing fixture is fixture-gap, not a product pass. Repair the fixture, then rerun the dependent journey.')

function printSession(session) {
  const sessionJourneys = session.journeys.map((journeyId) => journeyById.get(journeyId)).filter(Boolean)
  const fixtureIds = [...new Set(sessionJourneys.flatMap((journey) => journey.fixtures))]
  const fixtureGapRows = rows.filter((row) => session.journeys.includes(row.journeyId) && row.category === 'fixture-gap' && row.result !== 'pass')

  console.log(session.label)
  console.log(`  Question: ${session.question}`)
  console.log(`  Fixture blockers in ledger: ${fixtureGapRows.length}`)
  console.log('  Required fixtures:')
  for (const fixtureId of fixtureIds) {
    const label = fixtureLabels[fixtureId] ?? fixtureId
    const fixtureRows = rows.filter((row) => row.accountFixture === fixtureId || row.notes.includes(fixtureId) || row.nextAction.includes(fixtureId))
    const hasOpenFixtureGap = fixtureRows.some((row) => row.category === 'fixture-gap' && row.result !== 'pass')
    const state = hasOpenFixtureGap ? 'open fixture-gap' : fixtureRows.length ? 'seen in ledger' : 'confirm before test'
    console.log(`  - ${state}: ${fixtureId} (${label})`)
    console.log(`    Review: npm run qa:fixture-review -- ${fixtureId}`)
  }
  console.log('  Journeys:')
  for (const journey of sessionJourneys) {
    const journeyRows = rows.filter((row) => row.journeyId === journey.id)
    const latest = journeyRows.at(-1)
    const state = latest ? `${latest.result || 'logged'}${latest.category ? `/${latest.category}` : ''}` : 'not logged'
    console.log(`  - ${state}: ${journey.label} (${journey.id})`)
    console.log(`    Route: ${journey.route}`)
    console.log(`    Fixtures: ${journey.fixtures.join(', ')}`)
    console.log(`    Command: npm run qa:journey -- ${journey.id}`)
  }
  if (fixtureGapRows.length) {
    console.log('  Open fixture-gap rows:')
    for (const row of fixtureGapRows) {
      console.log(`  - ${row.journeyId}: ${row.notes || 'missing note'}; next: ${row.nextAction || 'missing next action'}`)
    }
  }
  console.log(`  Start: npm run qa:tester-packet -- ${session.id} --device=<phone|tablet|desktop>`)
  console.log('')
}

function matchesQuery(session) {
  if (!rawQuery) return true
  const sessionJourneys = session.journeys.map((journeyId) => journeyById.get(journeyId)).filter(Boolean)
  const haystack = [
    session.id,
    session.label,
    session.question,
    ...sessionJourneys.flatMap((journey) => [journey.id, journey.label, journey.route, ...journey.fixtures]),
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
