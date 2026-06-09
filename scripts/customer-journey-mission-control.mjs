import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, customerJourneySessions } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'

const sessions = customerJourneySessions.map((session) => ({
  id: session.id,
  label: session.focus,
  journeys: session.journeyIds,
}))

const tierDisplayIds = new Map([
  ['player_plus', 'player'],
  ['coach', 'coach'],
  ['captain', 'captain'],
  ['league', 'league'],
  ['full_court', 'full-court'],
  ['admin_internal', 'admin'],
  ['free', 'free'],
])

const tiers = [...new Map(customerJourneyDetails.map((journey) => [journey.tierId, journey.tier])).entries()].map(([tierId, label]) => ({
  id: tierDisplayIds.get(tierId) ?? tierId,
  label,
  journeys: customerJourneyDetails.filter((journey) => journey.tierId === tierId).map((journey) => journey.id),
}))

const plannedJourneyIds = [...new Set(sessions.flatMap((session) => session.journeys))]
const rows = extractResultLedger(readFileSync(join(process.cwd(), resultsPath), 'utf8'))
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))

const passRows = rows.filter((row) => row.result === 'pass')
const passWithEvidenceRows = passRows.filter((row) => row.screenshotOrVideo)
const passJourneyIds = new Set(passRows.map((row) => row.journeyId))
const evidenceJourneyIds = new Set(passWithEvidenceRows.map((row) => row.journeyId))
const testedJourneyIds = new Set(rows.map((row) => row.journeyId))
const openHighPriorityRows = rows.filter((row) => row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))
const openActionRows = rows.filter((row) => row.result !== 'pass')
const nextSession = sessions.find((session) => session.journeys.some((journeyId) => !evidenceJourneyIds.has(journeyId)))
const nextJourneyId = plannedJourneyIds.find((journeyId) => !evidenceJourneyIds.has(journeyId))

console.log('TenAceIQ QA Mission Control')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log('Use this as the compact meeting view for test-week readiness, blockers, and the next command.')
console.log('')

console.log('Scoreboard:')
console.log(`- Ledger rows: ${rows.length}`)
console.log(`- Journeys with any result: ${testedJourneyIds.size}/${plannedJourneyIds.length}`)
console.log(`- Journeys with pass rows: ${passJourneyIds.size}/${plannedJourneyIds.length}`)
console.log(`- Journeys with pass + evidence: ${evidenceJourneyIds.size}/${plannedJourneyIds.length}`)
console.log(`- Open p0/p1 rows: ${openHighPriorityRows.length}`)
console.log(`- Open non-pass rows: ${openActionRows.length}`)
console.log('')

if (openHighPriorityRows.length) {
  console.log('Stop first:')
  for (const row of openHighPriorityRows) {
    console.log(`- ${row.severity} ${row.result}: ${row.journeyId}`)
    console.log(`  Category: ${row.category || 'uncategorized'}`)
    console.log(`  Next action: ${row.nextAction || 'missing next action'}`)
  }
  console.log('')
  console.log('Next command: npm run qa:action-list')
} else if (nextSession) {
  console.log(`Next block: ${nextSession.id} - ${nextSession.label}`)
  console.log(`Next journey: ${nextJourneyId}`)
  console.log(`Next command: npm run qa:today -- ${nextSession.id} --date=yyyy-mm-dd --tester=<name>`)
} else {
  console.log('Next block: all planned journeys have pass + evidence.')
  console.log('Next command: npm run qa:launch')
}

console.log('')
console.log('Sessions:')
for (const session of sessions) {
  printGroupStatus(session.id, session.label, session.journeys, `npm run qa:today -- ${session.id}`)
}

console.log('')
console.log('Tiers:')
for (const tier of tiers) {
  printGroupStatus(tier.id, tier.label, tier.journeys, `npm run qa:trace -- ${tier.id}`)
}

console.log('')
console.log('Use with:')
console.log('- npm run qa:today -- --date=yyyy-mm-dd --tester=<name>')
console.log('- npm run qa:trace -- <tier>')
console.log('- npm run qa:scorecard')
console.log('- npm run qa:signoff')
console.log('- npm run qa:launch')
console.log('')
console.log('Closeout rule: mission control is green only when every planned journey has pass evidence and no p0/p1 row remains open.')

function printGroupStatus(id, label, journeys, command) {
  const passCount = journeys.filter((journeyId) => passJourneyIds.has(journeyId)).length
  const evidenceCount = journeys.filter((journeyId) => evidenceJourneyIds.has(journeyId)).length
  const blockers = rows.filter((row) => journeys.includes(row.journeyId) && row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))
  const missing = journeys.filter((journeyId) => !evidenceJourneyIds.has(journeyId))
  const state = blockers.length ? 'blocked' : missing.length ? 'needs proof' : 'ready'

  console.log(`- ${label} (${id}): ${state}; pass ${passCount}/${journeys.length}; evidence ${evidenceCount}/${journeys.length}; p0/p1 ${blockers.length}`)
  console.log(`  Next: ${missing.length ? command : 'npm run qa:close-day -- ' + findSessionForJourney(journeys[0])}`)
}

function findSessionForJourney(journeyId) {
  return sessions.find((session) => session.journeys.includes(journeyId))?.id ?? 'day1'
}

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
    screenshotOrVideo: cells[9] ?? '',
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
