import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv[2]?.trim().toLowerCase() ?? ''
const normalizedQuery = rawQuery.replace(/\s+/g, '').replace('-', '')

const sessions = [
  {
    id: 'day1',
    aliases: ['1', 'day1', 'trustloop'],
    label: 'Day 1',
    focus: 'Trust Loop',
    journeyIds: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
    closeoutQuestion: 'Can player proof and coach assignment close the trust loop without sync or mobile confusion?',
  },
  {
    id: 'day2',
    aliases: ['2', 'day2', 'playercoach'],
    label: 'Day 2',
    focus: 'Player And Coach Depth',
    journeyIds: ['coach-lesson-support', 'player-my-lab-return-state'],
    closeoutQuestion: 'Can recent work become a useful next lesson and a clear player return state?',
  },
  {
    id: 'day3',
    aliases: ['3', 'day3', 'captain'],
    label: 'Day 3',
    focus: 'Captain Week',
    journeyIds: ['captain-week-flow'],
    closeoutQuestion: 'Can a captain move from availability and context to lineup choice and team-facing communication?',
  },
  {
    id: 'day4',
    aliases: ['4', 'day4', 'leagueadmin'],
    label: 'Day 4',
    focus: 'League And Admin',
    journeyIds: ['league-result-to-public-context', 'admin-access-and-data-quality'],
    closeoutQuestion: 'Can operations, public/member context, access repair, and data review stay fixture-safe and connected?',
  },
  {
    id: 'day5',
    aliases: ['5', 'day5', 'regression'],
    label: 'Day 5',
    focus: 'Full-Court And Free/Public Regression',
    journeyIds: ['full-court-access-pass', 'free-public-discovery'],
    closeoutQuestion: 'Can multi-role access and free discovery work without stale locks or premature upgrade pressure?',
  },
]

const plannedJourneyIds = sessions.flatMap((session) => session.journeyIds)
const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const rows = source
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))

const selectedSessions = getSelectedSessions()

console.log('TenAceIQ Customer Journey Session Status')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log('Closeout rule: a session is ready to move on only when every listed journey has pass evidence and no open p0/p1 row remains for that session.')
console.log('')

for (const session of selectedSessions) {
  printSessionStatus(session)
}

if (!selectedSessions.length) {
  console.log(`No session matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:session-status -- <day1 | day2 | day3 | day4 | day5>')
  process.exit(1)
}

console.log('Use with:')
console.log('- npm run qa:session -- <day1-day5>')
console.log('- npm run qa:journey -- <journey-id>')
console.log('- npm run qa:results')
console.log('- npm run qa:launch')

function getSelectedSessions() {
  if (!rawQuery) return sessions

  return sessions.filter((session) => session.aliases.includes(normalizedQuery))
}

function printSessionStatus(session) {
  const sessionRows = rows.filter((row) => session.journeyIds.includes(row.journeyId))
  const passJourneyIds = new Set(sessionRows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
  const testedJourneyIds = new Set(sessionRows.map((row) => row.journeyId))
  const missingPassJourneyIds = session.journeyIds.filter((journeyId) => !passJourneyIds.has(journeyId))
  const missingAnyResultJourneyIds = session.journeyIds.filter((journeyId) => !testedJourneyIds.has(journeyId))
  const openHighPriorityRows = sessionRows.filter((row) => (row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass')
  const status = missingPassJourneyIds.length || openHighPriorityRows.length ? 'not ready' : 'ready'

  console.log(`${session.label}: ${status}`)
  console.log(`  Focus: ${session.focus}`)
  console.log(`  Question: ${session.closeoutQuestion}`)
  console.log(`  Pass journeys: ${passJourneyIds.size}/${session.journeyIds.length}`)
  console.log(`  Ledger rows: ${sessionRows.length}`)
  console.log(`  Open p0/p1: ${openHighPriorityRows.length}`)
  console.log('  Journeys:')

  for (const journeyId of session.journeyIds) {
    const marker = passJourneyIds.has(journeyId) ? 'pass' : testedJourneyIds.has(journeyId) ? 'needs review' : 'missing'
    console.log(`  - ${marker}: ${journeyId}`)
  }

  if (missingAnyResultJourneyIds.length) {
    console.log(`  Missing result rows: ${missingAnyResultJourneyIds.join(', ')}`)
  }

  if (openHighPriorityRows.length) {
    console.log('  Blocking p0/p1 rows:')
    for (const row of openHighPriorityRows) {
      console.log(`  - ${row.severity} ${row.result}: ${row.journeyId}`)
      console.log(`    Category: ${row.category || 'uncategorized'}`)
      console.log(`    Next action: ${row.nextAction || 'missing next action'}`)
    }
  }

  console.log('')
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
