import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fixtureGateJourneyIds, plannedJourneyIds } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'
const statuses = ['pass', 'fail', 'blocked', 'needs-follow-up']

const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const rows = source
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))

const byStatus = Object.fromEntries(statuses.map((status) => [status, 0]))
const testedJourneyIds = new Set()
const highPriorityOpenRows = []

for (const row of rows) {
  testedJourneyIds.add(row.journeyId)
  if (row.result in byStatus) byStatus[row.result] += 1

  if ((row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass') {
    highPriorityOpenRows.push(row)
  }
}

const missingJourneyIds = plannedJourneyIds.filter((journeyId) => !testedJourneyIds.has(journeyId))
const fixtureGapRows = rows.filter((row) => row.result !== 'pass' && row.category === 'fixture-gap')

console.log('TenAceIQ Customer Journey Result Summary')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log(`Ledger rows found: ${rows.length}`)
console.log(`Journeys with at least one result: ${testedJourneyIds.size}/${plannedJourneyIds.length}`)
console.log('')

console.log('By result:')
for (const status of statuses) {
  console.log(`- ${status}: ${byStatus[status]}`)
}

console.log('')
console.log('Missing journey results:')
if (missingJourneyIds.length === 0) {
  console.log('- None')
} else {
  for (const journeyId of missingJourneyIds) console.log(`- ${journeyId}`)
}

console.log('')
console.log('Open p0/p1 rows:')
if (highPriorityOpenRows.length === 0) {
  console.log('- None')
} else {
  for (const row of highPriorityOpenRows) {
    console.log(`- ${row.severity} ${row.result}: ${row.journeyId}`)
    console.log(`  Category: ${row.category || 'uncategorized'}`)
    console.log(`  Next action: ${row.nextAction || 'missing next action'}`)
  }
}

console.log('')
console.log('Open fixture-gap rows:')
if (fixtureGapRows.length === 0) {
  console.log('- None')
} else {
  for (const row of fixtureGapRows) {
    console.log(`- ${row.result}: ${row.journeyId}`)
    console.log(`  Fixture gate: npm run qa:fixture-gate -- ${row.journeyId}`)
    printFixtureAuthCommands(row.journeyId, '  ')
    console.log(`  Next action: ${row.nextAction || 'missing next action'}`)
  }
}

console.log('')
console.log('Closeout rule: every journey needs a pass row before the week is closed, and every p0/p1 needs a fix or explicit launch decision.')

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

function printFixtureAuthCommands(journeyId, indent) {
  if (!fixtureGateJourneyIds.has(journeyId)) return
  console.log(`${indent}Auth env: npm run qa:fixture-auth-smoke -- --env`)
  console.log(`${indent}Auth smoke: npm run qa:fixture-auth-smoke`)
}
