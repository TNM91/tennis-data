import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneySessions, fixtureGateJourneyIds, plannedJourneyIds } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'

const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const rows = source
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))

const passedJourneyIds = new Set(rows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
const openHighPriorityRows = rows.filter((row) => (row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass')
const firstIncompleteSession = customerJourneySessions.find((session) => session.journeyIds.some((journeyId) => !passedJourneyIds.has(journeyId)))

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
  if (fixtureGateJourneyIds.has(journeyId)) {
    console.log(`  Fixture gate: npm run qa:fixture-gate -- ${journeyId}`)
    console.log('  Auth env: npm run qa:fixture-auth-smoke -- --env')
    console.log('  Auth smoke: npm run qa:fixture-auth-smoke')
  }
}

console.log('')
console.log('Recommended commands:')
console.log('- npm run qa:status')
console.log(`- npm run qa:session -- ${firstIncompleteSession.id}`)
for (const journeyId of missingInSession.filter((id) => fixtureGateJourneyIds.has(id))) {
  console.log(`- npm run qa:fixture-gate -- ${journeyId}`)
  console.log('- npm run qa:fixture-auth-smoke -- --env')
  console.log('- npm run qa:fixture-auth-smoke')
}
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
