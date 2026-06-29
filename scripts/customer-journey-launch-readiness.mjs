import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getFixtureAuthSmokeCommand, journeyById, plannedJourneyIds } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'

const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const rows = source
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))

const passJourneyIds = new Set(rows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
const missingPassJourneyIds = plannedJourneyIds.filter((journeyId) => !passJourneyIds.has(journeyId))
const openHighPriorityRows = rows.filter((row) => (row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass')

console.log('TenAceIQ Customer Journey Launch Readiness')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log(`Pass journeys: ${passJourneyIds.size}/${plannedJourneyIds.length}`)
console.log(`Open p0/p1 rows: ${openHighPriorityRows.length}`)
console.log('')

if (missingPassJourneyIds.length) {
  console.log('Journeys missing pass evidence:')
  for (const journeyId of missingPassJourneyIds) {
    const authSmokeCommand = getFixtureAuthSmokeCommand(journeyById.get(journeyId)?.accountFixture ?? '')
    console.log(`- ${journeyId}`)
    if (authSmokeCommand) {
      console.log(`  Fixture gate: npm run qa:fixture-gate -- ${journeyId}`)
      console.log('  Auth env: npm run qa:fixture-auth-smoke -- --env')
      console.log(`  Auth smoke: ${authSmokeCommand}`)
    }
  }
} else {
  console.log('Journeys missing pass evidence:')
  console.log('- None')
}

console.log('')
if (openHighPriorityRows.length) {
  console.log('Open p0/p1 rows:')
  for (const row of openHighPriorityRows) {
    console.log(`- ${row.severity} ${row.result}: ${row.journeyId}`)
    console.log(`  Category: ${row.category || 'uncategorized'}`)
    console.log(`  Next action: ${row.nextAction || 'missing next action'}`)
  }
} else {
  console.log('Open p0/p1 rows:')
  console.log('- None')
}

if (missingPassJourneyIds.length || openHighPriorityRows.length) {
  console.log('')
  console.log('Launch readiness: not ready.')
  console.log('Closeout rule: every journey needs pass evidence and every p0/p1 needs a fix or explicit launch decision.')
  process.exit(1)
}

console.log('')
console.log('Launch readiness: ready based on recorded journey evidence.')

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
