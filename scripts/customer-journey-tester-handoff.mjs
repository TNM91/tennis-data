import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  customerJourneyDetails,
  customerJourneySessions,
  fixtureGateJourneyIds,
  resultRank,
  severityRank,
} from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'
const args = parseArgs(process.argv.slice(2))
const rawQuery = args.positionals.join(' ').trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)
const dateFilter = args.flags.date ?? ''
const testerFilter = args.flags.tester?.toLowerCase() ?? ''

const sessions = customerJourneySessions.map((session) => ({
  id: session.id,
  aliases: session.aliases,
  label: session.shortLabel,
  focus: session.focus,
  journeyIds: session.journeyIds,
}))

const journeyDetails = customerJourneyDetails.map((journey) => ({
  id: journey.id,
  tier: journey.tier,
  entryRoute: journey.entryRoute,
  accountFixture: journey.accountFixture,
}))

const journeyById = new Map(journeyDetails.map((journey) => [journey.id, journey]))
const sessionByJourneyId = new Map(sessions.flatMap((session) => session.journeyIds.map((journeyId) => [journeyId, session])))
const plannedJourneyIds = journeyDetails.map((journey) => journey.id)
const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const ledgerRows = extractResultLedger(source)
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))
  .filter((row) => !dateFilter || row.date === dateFilter)
  .filter((row) => !testerFilter || row.tester.toLowerCase() === testerFilter)

const selectedSessions = selectSessions()
const selectedJourneyIds = selectedSessions.flatMap((session) => session.journeyIds)
const selectedRows = ledgerRows.filter((row) => selectedJourneyIds.includes(row.journeyId))
const openRows = selectedRows.filter((row) => row.result && row.result !== 'pass').sort(sortRows)
const openHighPriorityRows = openRows.filter((row) => row.severity === 'p0' || row.severity === 'p1')
const fixtureGapRows = openRows.filter((row) => row.category === 'fixture-gap')
const passJourneyIds = new Set(selectedRows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
const testedJourneyIds = new Set(selectedRows.map((row) => row.journeyId))
const missingRowsJourneyIds = selectedJourneyIds.filter((journeyId) => !testedJourneyIds.has(journeyId))
const missingPassJourneyIds = selectedJourneyIds.filter((journeyId) => !passJourneyIds.has(journeyId))
const missingEvidenceRows = selectedRows.filter((row) => !row.screenshotOrVideo)
const missingNextActionRows = openRows.filter((row) => !row.nextAction)

console.log('TenAceIQ Tester Handoff')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log('Use this between testers or at the end of a testing block so the next person can pick up without memory.')

if (rawQuery) console.log(`Filter: ${rawQuery}`)
if (dateFilter) console.log(`Date filter: ${dateFilter}`)
if (testerFilter) console.log(`Tester filter: ${testerFilter}`)
console.log('')

if (!selectedSessions.length) {
  console.log(`No session, journey, tier, or route matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:tester-handoff -- <day1-day5 | journey | tier> [--date=yyyy-mm-dd] [--tester=<name>]')
  process.exit(1)
}

console.log('Session summary:')
for (const session of selectedSessions) {
  const sessionRows = selectedRows.filter((row) => session.journeyIds.includes(row.journeyId))
  const sessionOpenRows = sessionRows.filter((row) => row.result && row.result !== 'pass')
  const sessionPassJourneyIds = new Set(sessionRows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
  const sessionMissingPass = session.journeyIds.filter((journeyId) => !sessionPassJourneyIds.has(journeyId))
  const sessionMissingEvidence = sessionRows.filter((row) => !row.screenshotOrVideo)
  const sessionHighPriority = sessionOpenRows.filter((row) => row.severity === 'p0' || row.severity === 'p1')

  console.log(`- ${session.label}: ${session.focus}`)
  console.log(`  Journeys: ${session.journeyIds.join(', ')}`)
  console.log(`  Rows logged: ${sessionRows.length}`)
  console.log(`  Pass evidence: ${session.journeyIds.length - sessionMissingPass.length}/${session.journeyIds.length}`)
  console.log(`  Missing screenshot/video: ${sessionMissingEvidence.length}`)
  console.log(`  Open p0/p1: ${sessionHighPriority.length}`)
  console.log(`  Open non-pass rows: ${sessionOpenRows.length}`)

  for (const journeyId of session.journeyIds) {
    const journey = journeyById.get(journeyId)
    console.log(`  - ${journeyId}: ${journey?.entryRoute ?? 'missing route'} (${journey?.accountFixture ?? 'missing fixture'})`)
  }
}

console.log('')
console.log('Carry forward:')
printCarryForward()

console.log('')
console.log('Next commands:')
console.log('- npm run qa:fixture-status -- <day1-day5 | fixture | journey | route>')
console.log('- npm run qa:fixture-gate -- <journey | fixture | route | search>')
console.log('- npm run qa:fixture-auth-smoke -- --env')
console.log('- npm run qa:fixture-auth-smoke')
console.log('- npm run qa:tester-packet -- <day1-day5> --device=<phone|tablet|desktop>')
console.log('- npm run qa:retest -- <day-or-journey>')
console.log('- npm run qa:action-list')
console.log('- npm run qa:close-day -- <day1-day5>')
console.log('- npm run qa:scorecard')
console.log('')
console.log('Handoff rule: next tester should know what was tested, what is blocked, what evidence exists, and what command to run next.')

function printCarryForward() {
  if (
    !openHighPriorityRows.length &&
    !fixtureGapRows.length &&
    !missingRowsJourneyIds.length &&
    !missingPassJourneyIds.length &&
    !missingEvidenceRows.length &&
    !missingNextActionRows.length
  ) {
    console.log('- Nothing obvious from the ledger. Confirm with npm run qa:scorecard before broad signoff.')
    return
  }

  if (openHighPriorityRows.length) {
    console.log(`- Open p0/p1 rows: ${openHighPriorityRows.length}`)
    for (const row of openHighPriorityRows) printRow(row)
  }

  const otherOpenRows = openRows.filter((row) => row.severity !== 'p0' && row.severity !== 'p1')
  if (otherOpenRows.length) {
    console.log(`- Other open rows: ${otherOpenRows.length}`)
    for (const row of otherOpenRows) printRow(row)
  }

  if (fixtureGapRows.length) {
    console.log(`- fixture-gap blockers: ${fixtureGapRows.length}`)
    for (const row of fixtureGapRows) {
      console.log(`  - ${row.journeyId}: ${row.accountFixture || 'missing fixture'}; next ${row.nextAction || 'npm run qa:fixture-review -- <fixture>'}`)
      console.log(`    Fixture gate: npm run qa:fixture-gate -- ${row.journeyId}`)
      printFixtureAuthCommands(row.journeyId, '    ')
    }
  }

  if (missingRowsJourneyIds.length) {
    console.log(`- Journeys with no logged row: ${missingRowsJourneyIds.length}`)
    for (const journeyId of missingRowsJourneyIds) printJourneyNeed(journeyId, 'log a real result row')
  }

  if (missingPassJourneyIds.length) {
    console.log(`- missing pass evidence: ${missingPassJourneyIds.length}`)
    for (const journeyId of missingPassJourneyIds) printJourneyNeed(journeyId, 'record a pass row with proof')
  }

  if (missingEvidenceRows.length) {
    console.log(`- missing screenshot/video: ${missingEvidenceRows.length}`)
    for (const row of missingEvidenceRows) {
      console.log(`  - ${row.journeyId}: ${row.result || 'unknown result'}; add evidence or rerun`)
    }
  }

  if (missingNextActionRows.length) {
    console.log(`- Rows missing next action: ${missingNextActionRows.length}`)
    for (const row of missingNextActionRows) {
      console.log(`  - ${row.journeyId}: add a next action or retest command`)
    }
  }
}

function printRow(row) {
  const session = sessionByJourneyId.get(row.journeyId)
  console.log(`  - ${row.severity || 'unscored'} ${row.result || 'unknown'}: ${row.journeyId}`)
  console.log(`    Session: ${session?.id ?? 'unknown'}${session ? ` (${session.focus})` : ''}`)
  console.log(`    Category: ${row.category || 'uncategorized'}`)
  if (row.category === 'fixture-gap') {
    console.log(`    Fixture gate: npm run qa:fixture-gate -- ${row.journeyId}`)
    printFixtureAuthCommands(row.journeyId, '    ')
  }
  console.log(`    Evidence: ${row.screenshotOrVideo || 'missing screenshot/video'}`)
  console.log(`    Notes: ${row.notes || 'none'}`)
  console.log(`    Next action: ${row.nextAction || 'missing next action'}`)
}

function printJourneyNeed(journeyId, need) {
  const journey = journeyById.get(journeyId)
  const session = sessionByJourneyId.get(journeyId)

  console.log(`  - ${journeyId}: ${need}`)
  console.log(`    Session: ${session?.id ?? 'unknown'}${session ? ` (${session.focus})` : ''}`)
  console.log(`    Route: ${journey?.entryRoute ?? 'missing route'}`)
  console.log(`    Fixture: ${journey?.accountFixture ?? 'missing fixture'}`)
  if (fixtureGateJourneyIds.has(journeyId)) {
    console.log(`    Fixture gate: npm run qa:fixture-gate -- ${journeyId}`)
  }
  printFixtureAuthCommands(journeyId, '    ')
  console.log(`    Commands: npm run qa:tester-packet -- ${session?.id ?? '<day>'} --device=<phone|tablet|desktop>; npm run qa:retest -- ${journeyId}`)
}

function printFixtureAuthCommands(journeyId, indent) {
  if (!fixtureGateJourneyIds.has(journeyId)) return
  console.log(`${indent}Auth env: npm run qa:fixture-auth-smoke -- --env`)
  console.log(`${indent}Auth smoke: npm run qa:fixture-auth-smoke`)
}

function selectSessions() {
  if (!rawQuery) return sessions

  return sessions.filter((session) => {
    if (session.aliases.includes(normalizedQuery)) return true

    return session.journeyIds.some((journeyId) => {
      const journey = journeyById.get(journeyId)
      return normalize([journeyId, journey?.tier, journey?.entryRoute, journey?.accountFixture, session.focus, session.label].join(' ')).includes(normalizedQuery)
    })
  })
}

function sortRows(a, b) {
  const severityDelta = (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4)
  if (severityDelta !== 0) return severityDelta

  const resultDelta = (resultRank[a.result] ?? 4) - (resultRank[b.result] ?? 4)
  if (resultDelta !== 0) return resultDelta

  return plannedJourneyIds.indexOf(a.journeyId) - plannedJourneyIds.indexOf(b.journeyId)
}

function extractResultLedger(markdown) {
  const startMarker = '## Result Ledger'
  const endMarker = '## Daily Summary'
  const startIndex = markdown.indexOf(startMarker)

  if (startIndex === -1) return ''

  const endIndex = markdown.indexOf(endMarker, startIndex + startMarker.length)
  return endIndex === -1 ? markdown.slice(startIndex) : markdown.slice(startIndex, endIndex)
}

function parseArgs(rawArgs) {
  const flags = {}
  const positionals = []

  for (const arg of rawArgs) {
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.slice(2).split('=')
      flags[key] = valueParts.join('=') || 'true'
    } else {
      positionals.push(arg)
    }
  }

  return { flags, positionals }
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

function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, '').replaceAll('-', '')
}
