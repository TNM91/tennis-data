import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneySessions, fixtureGateJourneyIds, getFixtureAuthSmokeCommand, journeyById, normalizeQaQuery, plannedJourneyIds } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv[2]?.trim().toLowerCase() ?? ''
const normalizedQuery = normalizeQaQuery(rawQuery)
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
  if (!rawQuery) return customerJourneySessions

  return customerJourneySessions.filter((session) => session.aliases.includes(normalizedQuery))
}

function printSessionStatus(session) {
  const sessionRows = rows.filter((row) => session.journeyIds.includes(row.journeyId))
  const passJourneyIds = new Set(sessionRows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
  const testedJourneyIds = new Set(sessionRows.map((row) => row.journeyId))
  const missingPassJourneyIds = session.journeyIds.filter((journeyId) => !passJourneyIds.has(journeyId))
  const missingAnyResultJourneyIds = session.journeyIds.filter((journeyId) => !testedJourneyIds.has(journeyId))
  const openHighPriorityRows = sessionRows.filter((row) => (row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass')
  const openFixtureRows = sessionRows.filter((row) => row.category === 'fixture-gap' && row.result !== 'pass')
  const status = missingPassJourneyIds.length || openHighPriorityRows.length ? 'not ready' : 'ready'

  console.log(`${session.shortLabel}: ${status}`)
  console.log(`  Focus: ${session.focus}`)
  console.log(`  Question: ${session.closeoutQuestion}`)
  console.log(`  Pass journeys: ${passJourneyIds.size}/${session.journeyIds.length}`)
  console.log(`  Ledger rows: ${sessionRows.length}`)
  console.log(`  Fixture blockers: ${openFixtureRows.length}`)
  console.log(`  Open p0/p1: ${openHighPriorityRows.length}`)
  console.log('  Journeys:')

  for (const journeyId of session.journeyIds) {
    const hasFixtureBlocker = openFixtureRows.some((row) => row.journeyId === journeyId)
    const marker = passJourneyIds.has(journeyId) ? 'pass' : hasFixtureBlocker ? 'fixture blocked' : testedJourneyIds.has(journeyId) ? 'needs review' : 'missing'
    console.log(`  - ${marker}: ${journeyId}`)
    if (hasFixtureBlocker) {
      console.log(`    Fixture gate: npm run qa:fixture-gate -- ${journeyId}`)
      printFixtureAuthCommands(journeyId, '    ')
    }
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

  if (openFixtureRows.length) {
    console.log('  Fixture blockers:')
    for (const row of openFixtureRows) {
      console.log(`  - ${row.journeyId}: npm run qa:fixture-gate -- ${row.journeyId}`)
      printFixtureAuthCommands(row.journeyId, '    ')
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

function printFixtureAuthCommands(journeyId, indent) {
  const row = [...rows].reverse().find((item) => item.journeyId === journeyId && item.category === 'fixture-gap' && item.result !== 'pass')
  const authSmokeCommand = getFixtureAuthSmokeCommand(row?.accountFixture || journeyById.get(journeyId)?.accountFixture || '')
  if (!fixtureGateJourneyIds.has(journeyId) && !authSmokeCommand) return
  console.log(`${indent}Auth env: npm run qa:fixture-auth-smoke -- --env`)
  console.log(`${indent}Auth smoke: ${authSmokeCommand || 'npm run qa:fixture-auth-smoke'}`)
}
