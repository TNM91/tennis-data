import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const sessions = [
  {
    id: 'day1',
    label: 'Day 1 - Trust Loop',
    journeyIds: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
    focusCommands: ['npm run qa:focus -- player-practice-progress-loop', 'npm run qa:focus -- coach-assignment-lesson-loop'],
  },
  {
    id: 'day2',
    label: 'Day 2 - Player And Coach Depth',
    journeyIds: ['coach-lesson-support', 'player-my-lab-return-state'],
    focusCommands: ['npm run qa:focus -- coach-assignment-lesson-loop', 'npm run qa:focus -- player-practice-progress-loop'],
  },
  {
    id: 'day3',
    label: 'Day 3 - Captain Week',
    journeyIds: ['captain-week-flow'],
    focusCommands: ['npm run qa:focus -- captain-week-decision-loop'],
  },
  {
    id: 'day4',
    label: 'Day 4 - League And Admin',
    journeyIds: ['league-result-to-public-context', 'admin-access-and-data-quality'],
    focusCommands: ['npm run qa:focus -- league-operation-visibility-loop', 'npm run qa:focus -- admin-access-data-quality-loop'],
  },
  {
    id: 'day5',
    label: 'Day 5 - Full-Court And Free/Public Regression',
    journeyIds: ['full-court-access-pass', 'free-public-discovery'],
    focusCommands: ['npm run qa:focus -- full-court-role-switching-loop', 'npm run qa:focus -- free-discovery-to-upgrade'],
  },
]

const plannedJourneyIds = sessions.flatMap((session) => session.journeyIds)
const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const rows = source
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))

const passedJourneyIds = new Set(rows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
const openHighPriorityRows = rows.filter((row) => (row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass')
const firstIncompleteSession = sessions.find((session) => session.journeyIds.some((journeyId) => !passedJourneyIds.has(journeyId)))

console.log('TenAceIQ Next Journey QA Move')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log(`Pass coverage: ${passedJourneyIds.size}/${plannedJourneyIds.length} journeys`)
console.log('')

if (openHighPriorityRows.length) {
  console.log('Fix or decide these p0/p1 items before moving wider:')
  for (const row of openHighPriorityRows) {
    console.log(`- ${row.severity} ${row.result}: ${row.journeyId}`)
    console.log(`  Category: ${row.category || 'uncategorized'}`)
    console.log(`  Next action: ${row.nextAction || 'missing next action'}`)
  }
  console.log('')
  console.log('Recommended commands:')
  console.log('- npm run qa:triage')
  console.log('- npm run qa:results')
  process.exit(0)
}

if (!firstIncompleteSession) {
  console.log('All planned journeys have at least one pass row.')
  console.log('')
  console.log('Recommended commands:')
  console.log('- npm run qa:launch')
  console.log('- npm run verify:closeout:live')
  process.exit(0)
}

const missingInSession = firstIncompleteSession.journeyIds.filter((journeyId) => !passedJourneyIds.has(journeyId))

console.log(`Next session: ${firstIncompleteSession.label}`)
console.log(`Session command: npm run qa:session -- ${firstIncompleteSession.id}`)
console.log('')
console.log('Journeys still needing a pass:')
for (const journeyId of missingInSession) {
  console.log(`- ${journeyId}`)
}

console.log('')
console.log('Recommended commands:')
console.log('- npm run qa:status')
console.log(`- npm run qa:session -- ${firstIncompleteSession.id}`)
for (const command of firstIncompleteSession.focusCommands) {
  console.log(`- ${command}`)
}
console.log('- npm run qa:evidence')
console.log('- npm run qa:triage')
console.log('- npm run qa:results')

console.log('')
console.log('Closeout rule: test the earliest incomplete trust loop before moving wider.')

function parseMarkdownRow(line) {
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())

  return {
    journeyId: cells[4] ?? '',
    result: cells[6] ?? '',
    category: cells[7] ?? '',
    severity: cells[8] ?? '',
    nextAction: cells[11] ?? '',
  }
}
