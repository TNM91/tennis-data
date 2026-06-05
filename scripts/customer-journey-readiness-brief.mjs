import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const resultsPath = 'docs/customer-journey-test-results.md'

const requiredDocs = [
  'docs/customer-journey-qa-index.md',
  'docs/customer-journey-weekly-runbook.md',
  'docs/customer-journey-day-one-runbook.md',
  'docs/customer-journey-test-plan.md',
  'docs/customer-journey-test-results.md',
  'docs/customer-journey-test-fixtures.md',
  'docs/customer-journey-process-map.md',
  'docs/level-up-sync-audit.md',
  'docs/platform-closeout-qa.md',
]

const requiredStartCommands = [
  'qa:prep',
  'qa:status',
  'qa:week-plan',
  'qa:tester-packet',
  'qa:device-ledger',
  'qa:device-status',
  'qa:ledger-check',
  'qa:scorecard',
  'qa:launch',
]

const plannedJourneys = [
  {
    id: 'player-level-up-mobile-loop',
    session: 'day1',
    fixture: 'player_plus_linked',
    route: '/player-development/relentless-competitor-4-0/level-up',
  },
  {
    id: 'coach-player-assigned-challenge',
    session: 'day1',
    fixture: 'coach_primary',
    route: '/coach',
  },
  {
    id: 'coach-lesson-support',
    session: 'day2',
    fixture: 'coach_primary',
    route: '/player-development/relentless-competitor-4-0/coach-planner',
  },
  {
    id: 'player-my-lab-return-state',
    session: 'day2',
    fixture: 'player_plus_linked',
    route: '/mylab',
  },
  {
    id: 'captain-week-flow',
    session: 'day3',
    fixture: 'captain_primary',
    route: '/captain',
  },
  {
    id: 'league-result-to-public-context',
    session: 'day4',
    fixture: 'league_coordinator',
    route: '/league-coordinator',
  },
  {
    id: 'full-court-access-pass',
    session: 'day5',
    fixture: 'full_court_operator',
    route: '/pricing',
  },
  {
    id: 'admin-access-and-data-quality',
    session: 'day4',
    fixture: 'admin_test',
    route: '/admin/access',
  },
  {
    id: 'free-public-discovery',
    session: 'day5',
    fixture: 'free_viewer',
    route: '/explore',
  },
]

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const resultsSource = existsSync(join(root, resultsPath)) ? readFileSync(join(root, resultsPath), 'utf8') : ''
const rows = extractResultLedger(resultsSource)
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneys.some((journey) => journey.id === row.journeyId))

const missingDocs = requiredDocs.filter((doc) => !existsSync(join(root, doc)))
const missingCommands = requiredStartCommands.filter((command) => !packageJson.scripts?.[command])
const journeyIdsWithRows = new Set(rows.map((row) => row.journeyId))
const passJourneyIds = new Set(rows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
const missingResultJourneys = plannedJourneys.filter((journey) => !journeyIdsWithRows.has(journey.id))
const missingPassJourneys = plannedJourneys.filter((journey) => !passJourneyIds.has(journey.id))
const openHighPriorityRows = rows.filter((row) => (row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass')
const fixtureIds = [...new Set(plannedJourneys.map((journey) => journey.fixture))]
const isReadyToStart = missingDocs.length === 0 && missingCommands.length === 0
const isLaunchReady = isReadyToStart && missingPassJourneys.length === 0 && openHighPriorityRows.length === 0

console.log('TenAceIQ Journey Test Readiness Brief')
console.log('')
console.log('Use this before a manual testing block to confirm the packet is ready, the ledger state is understood, and the next command is obvious.')
console.log('')

console.log('Packet Health:')
console.log(`- Docs present: ${requiredDocs.length - missingDocs.length}/${requiredDocs.length}`)
console.log(`- Start commands registered: ${requiredStartCommands.length - missingCommands.length}/${requiredStartCommands.length}`)
console.log(`- Ready to start testing: ${isReadyToStart ? 'yes' : 'no'}`)

if (missingDocs.length) {
  console.log('')
  console.log('Missing docs:')
  for (const doc of missingDocs) console.log(`- ${doc}`)
}

if (missingCommands.length) {
  console.log('')
  console.log('Missing commands:')
  for (const command of missingCommands) console.log(`- npm run ${command}`)
}

console.log('')
console.log('Ledger State:')
console.log(`- Result rows recorded: ${rows.length}`)
console.log(`- Journeys with any result: ${journeyIdsWithRows.size}/${plannedJourneys.length}`)
console.log(`- Journeys with pass evidence: ${passJourneyIds.size}/${plannedJourneys.length}`)
console.log(`- Open p0/p1 rows: ${openHighPriorityRows.length}`)
console.log(`- Launch ready from ledger: ${isLaunchReady ? 'yes' : 'no'}`)

console.log('')
console.log('Missing Result Rows:')
if (missingResultJourneys.length) {
  for (const journey of missingResultJourneys) console.log(`- ${journey.session}: ${journey.id} (${journey.route})`)
} else {
  console.log('- None')
}

console.log('')
console.log('Missing Pass Evidence:')
if (missingPassJourneys.length) {
  for (const journey of missingPassJourneys) console.log(`- ${journey.session}: ${journey.id}`)
} else {
  console.log('- None')
}

if (openHighPriorityRows.length) {
  console.log('')
  console.log('Open p0/p1 Rows:')
  for (const row of openHighPriorityRows) {
    console.log(`- ${row.severity} ${row.result}: ${row.journeyId}`)
    console.log(`  Category: ${row.category || 'uncategorized'}`)
    console.log(`  Next action: ${row.nextAction || 'missing next action'}`)
  }
}

console.log('')
console.log('Fixture Reminder:')
for (const fixtureId of fixtureIds) {
  console.log(`- ${fixtureId}`)
}

console.log('')
console.log('Start Here:')
console.log('- npm run qa:prep')
console.log('- npm run qa:week-plan -- --date=yyyy-mm-dd --tester=<name>')
console.log('- npm run qa:tester-packet -- day1 --device=phone --date=yyyy-mm-dd --tester=<name>')
console.log('- npm run qa:device-ledger -- phone --date=yyyy-mm-dd --tester=<name>')
console.log('- npm run qa:ledger-check after logging rows')
console.log('- npm run qa:launch only after pass evidence is logged')
console.log('')
console.log('Closeout rule: ready to start means the packet exists; ready to launch means the ledger has pass evidence for every journey and no open p0/p1 row.')

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

function extractResultLedger(markdown) {
  const startMarker = '## Result Ledger'
  const endMarker = '## Daily Summary'
  const startIndex = markdown.indexOf(startMarker)

  if (startIndex === -1) return ''

  const endIndex = markdown.indexOf(endMarker, startIndex + startMarker.length)
  return endIndex === -1 ? markdown.slice(startIndex) : markdown.slice(startIndex, endIndex)
}
