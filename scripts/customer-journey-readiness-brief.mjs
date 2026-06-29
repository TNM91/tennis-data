import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, plannedJourneyIds, sessionByJourneyId } from './customer-journey-qa-data.mjs'

const root = process.cwd()
const resultsPath = 'docs/customer-journey-test-results.md'

const requiredDocs = [
  'docs/customer-journey-qa-index.md',
  'docs/customer-journey-weekly-runbook.md',
  'docs/customer-journey-day-one-runbook.md',
  'docs/customer-journey-test-plan.md',
  'docs/customer-journey-test-results.md',
  'docs/customer-journey-test-fixtures.md',
  'docs/customer-journey-fixture-provisioning-packet.md',
  'docs/customer-journey-fixture-env-template.md',
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

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const resultsSource = existsSync(join(root, resultsPath)) ? readFileSync(join(root, resultsPath), 'utf8') : ''
const rows = extractResultLedger(resultsSource)
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))

const missingDocs = requiredDocs.filter((doc) => !existsSync(join(root, doc)))
const missingCommands = requiredStartCommands.filter((command) => !packageJson.scripts?.[command])
const journeyIdsWithRows = new Set(rows.map((row) => row.journeyId))
const passJourneyIds = new Set(rows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
const missingResultJourneys = customerJourneyDetails.filter((journey) => !journeyIdsWithRows.has(journey.id))
const missingPassJourneys = customerJourneyDetails.filter((journey) => !passJourneyIds.has(journey.id))
const openHighPriorityRows = rows.filter((row) => (row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass')
const fixtureIds = [...new Set(customerJourneyDetails.map((journey) => journey.accountFixture))]
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
console.log(`- Journeys with any result: ${journeyIdsWithRows.size}/${plannedJourneyIds.length}`)
console.log(`- Journeys with pass evidence: ${passJourneyIds.size}/${plannedJourneyIds.length}`)
console.log(`- Open p0/p1 rows: ${openHighPriorityRows.length}`)
console.log(`- Launch ready from ledger: ${isLaunchReady ? 'yes' : 'no'}`)

console.log('')
console.log('Missing Result Rows:')
if (missingResultJourneys.length) {
  for (const journey of missingResultJourneys) console.log(`- ${sessionByJourneyId.get(journey.id)?.id ?? 'unknown'}: ${journey.id} (${journey.entryRoute})`)
} else {
  console.log('- None')
}

console.log('')
console.log('Missing Pass Evidence:')
if (missingPassJourneys.length) {
  for (const journey of missingPassJourneys) console.log(`- ${sessionByJourneyId.get(journey.id)?.id ?? 'unknown'}: ${journey.id}`)
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
console.log('- npm run qa:fixture-auth-smoke -- --env')
console.log('- npm run qa:fixture-auth-smoke -- <fixture | day3 | day4 | day5 | paid | all> after fixture credentials exist')
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
