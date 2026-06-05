const rawQuery = process.argv[2]?.trim().toLowerCase() ?? ''
const normalizedQuery = rawQuery.replace(/\s+/g, '').replace('-', '')

const sessions = [
  {
    id: 'day1',
    aliases: ['1', 'day1', 'trustloop'],
    label: 'Day 1',
    focus: 'Trust Loop',
    journeyIds: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
  },
  {
    id: 'day2',
    aliases: ['2', 'day2', 'playercoach'],
    label: 'Day 2',
    focus: 'Player And Coach Depth',
    journeyIds: ['coach-lesson-support', 'player-my-lab-return-state'],
  },
  {
    id: 'day3',
    aliases: ['3', 'day3', 'captain'],
    label: 'Day 3',
    focus: 'Captain Week',
    journeyIds: ['captain-week-flow'],
  },
  {
    id: 'day4',
    aliases: ['4', 'day4', 'leagueadmin'],
    label: 'Day 4',
    focus: 'League And Admin',
    journeyIds: ['league-result-to-public-context', 'admin-access-and-data-quality'],
  },
  {
    id: 'day5',
    aliases: ['5', 'day5', 'regression'],
    label: 'Day 5',
    focus: 'Full-Court And Free/Public Regression',
    journeyIds: ['full-court-access-pass', 'free-public-discovery'],
  },
]

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    entryRoute: '/player-development/relentless-competitor-4-0/level-up',
    accountFixture: 'player_plus_linked',
  },
  {
    id: 'coach-player-assigned-challenge',
    entryRoute: '/coach',
    accountFixture: 'coach_primary',
  },
  {
    id: 'coach-lesson-support',
    entryRoute: '/player-development/relentless-competitor-4-0/coach-planner',
    accountFixture: 'coach_primary',
  },
  {
    id: 'player-my-lab-return-state',
    entryRoute: '/mylab',
    accountFixture: 'player_plus_linked',
  },
  {
    id: 'captain-week-flow',
    entryRoute: '/captain',
    accountFixture: 'captain_primary',
  },
  {
    id: 'league-result-to-public-context',
    entryRoute: '/league-coordinator',
    accountFixture: 'league_coordinator',
  },
  {
    id: 'full-court-access-pass',
    entryRoute: '/pricing',
    accountFixture: 'full_court_operator',
  },
  {
    id: 'admin-access-and-data-quality',
    entryRoute: '/admin/access',
    accountFixture: 'admin_test',
  },
  {
    id: 'free-public-discovery',
    entryRoute: '/explore',
    accountFixture: 'free_viewer',
  },
]
const journeyById = new Map(journeys.map((journey) => [journey.id, journey]))
const session = sessions.find((item) => item.aliases.includes(normalizedQuery))

console.log('TenAceIQ Customer Journey Session Ledger Rows')
console.log('')

if (!session) {
  console.log('Usage: npm run qa:session-ledger -- <day1 | day2 | day3 | day4 | day5>')
  console.log('')
  console.log('Available sessions:')
  for (const item of sessions) {
    console.log(`- ${item.id}: ${item.label} - ${item.focus}`)
  }
  console.log('')
  console.log('Use `npm run qa:ledger` when you want starter rows for every planned journey.')
  process.exit(rawQuery ? 1 : 0)
}

console.log(`${session.label}: ${session.focus}`)
console.log('Paste these rows into docs/customer-journey-test-results.md under Result Ledger as you test this session.')
console.log('')
console.log('| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')

for (const journeyId of session.journeyIds) {
  const journey = journeyById.get(journeyId)
  if (!journey) continue

  console.log(
    `|  |  |  | ${journey.accountFixture} | ${journey.id} | ${journey.entryRoute} | needs-follow-up |  |  |  |  |  |`
  )
}

console.log('')
console.log('Fill before validating:')
console.log('- date, tester, device/browser')
console.log('- result: pass, fail, blocked, or needs-follow-up')
console.log('- screenshot/video evidence for pass, fail, and follow-up rows')
console.log('- category, severity, notes, and next action for non-pass rows')
console.log('')
console.log('Use with:')
console.log(`- npm run qa:session -- ${session.id}`)
console.log(`- npm run qa:session-status -- ${session.id}`)
console.log('- npm run qa:ledger-check')
console.log('- npm run qa:daily-summary -- <yyyy-mm-dd>')
