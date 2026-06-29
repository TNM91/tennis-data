import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, fixtureGateJourneyIds, getFixtureAuthSmokeCommand, sessionByJourneyId, tierAliases } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)
const issueCategories = [
  'sync-gap',
  'access-gap',
  'gating-gap',
  'fixture-gap',
  'data-propagation-gap',
  'mobile-ux-gap',
  'content-quality-gap',
  'return-state-gap',
  'visual-polish',
  'product-logic',
]

const journeys = customerJourneyDetails.map((journey) => ({
  id: journey.id,
  label: journey.label,
  tier: journey.tier,
  tierId: journey.tierId,
  session: sessionByJourneyId.get(journey.id)?.id ?? 'unassigned',
  route: journey.entryRoute,
  fixture: journey.accountFixture,
  passSignal: journey.passSignal,
}))

const rows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => !isHeaderRow(row) && !isBlankTemplateRow(row))

const selectedJourneys = journeys.filter(matchesJourney)
const selectedJourneyIds = new Set(selectedJourneys.map((journey) => journey.id))
const selectedRows = rows.filter((row) => selectedJourneyIds.has(row.journeyId))
const proofRows = selectedJourneys.map(buildProofRow)
const missingPass = proofRows.filter((row) => row.state === 'missing-pass')
const missingEvidence = proofRows.filter((row) => row.state === 'missing-evidence')
const openBlockers = selectedRows.filter((row) => row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))
const openFollowUps = selectedRows.filter((row) => row.result !== 'pass' && row.severity !== 'p0' && row.severity !== 'p1')

console.log('TenAceIQ Proof Gap Board')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log('Use this after testing or before signoff to see what still blocks journey trust: missing pass rows, missing screenshot/video, open blockers, and follow-up proof.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!selectedJourneys.length) {
  console.log(`No journey matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:proof-gaps -- <day1-day5 | tier | journey | route | fixture | category>')
  process.exit(1)
}

console.log('Summary:')
console.log(`- Journeys reviewed: ${selectedJourneys.length}`)
console.log(`- Signed off: ${proofRows.filter((row) => row.state === 'signed-off').length}`)
console.log(`- Missing pass evidence: ${missingPass.length}`)
console.log(`- Pass rows missing screenshot/video: ${missingEvidence.length}`)
console.log(`- Open p0/p1 blockers: ${openBlockers.length}`)
console.log(`- Open follow-up rows: ${openFollowUps.length}`)
console.log('')

printSection('Missing pass evidence', missingPass, (row) => {
  const authSmokeCommand = getFixtureAuthSmokeCommand(row.journey.fixture)
  console.log(`- ${row.journey.label} (${row.journey.id})`)
  console.log(`  Tier/session: ${row.journey.tier} / ${row.journey.session}`)
  console.log(`  Need: log a real pass row that proves: ${row.journey.passSignal}`)
  if (fixtureGateJourneyIds.has(row.journey.id) || authSmokeCommand) {
    console.log(`  Fixture gate: npm run qa:fixture-gate -- ${row.journey.id}`)
  }
  printFixtureAuthCommands(row.journey.id, '  ')
  console.log(`  Next: npm run qa:kickoff -- ${row.journey.id}`)
})

printSection('Pass rows missing screenshot/video', missingEvidence, (row) => {
  console.log(`- ${row.journey.label} (${row.journey.id})`)
  console.log(`  Latest pass: ${row.latestPass?.date || 'date missing'} by ${row.latestPass?.tester || 'tester missing'}`)
  console.log(`  Need: add screenshot/video evidence that proves the pass signal.`)
  console.log(`  Next: npm run qa:evidence-pack -- ${row.journey.session}`)
})

printRows('Open p0/p1 blockers', openBlockers)
printRows('Open follow-up proof rows', openFollowUps)

console.log('Use with:')
console.log('- npm run qa:kickoff -- <journey-id>')
console.log('- npm run qa:evidence-pack -- <day1-day5>')
console.log('- npm run qa:ledger-check')
console.log('- npm run qa:scorecard')
console.log('- npm run qa:signoff')
console.log('- npm run qa:launch')
console.log('')
console.log('Proof gap rule: a journey is not trusted until it has a pass row, screenshot/video evidence, and no newer p0/p1 blocker for the same journey.')

function buildProofRow(journey) {
  const journeyRows = selectedRows.filter((row) => row.journeyId === journey.id)
  const passRows = journeyRows.filter((row) => row.result === 'pass')
  const latestPass = passRows.at(-1)
  const hasOpenHighPriority = journeyRows.some((row) => row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))

  let state = 'signed-off'
  if (!passRows.length) state = 'missing-pass'
  else if (!passRows.some((row) => row.screenshotOrVideo)) state = 'missing-evidence'
  else if (hasOpenHighPriority) state = 'blocked'

  return {
    journey,
    journeyRows,
    latestPass,
    state,
  }
}

function matchesJourney(journey) {
  if (!rawQuery) return true
  if (/^day[1-5]$/.test(normalizedQuery)) return journey.session === normalizedQuery

  const tierLabel = tierAliases.get(normalizedQuery.replace(/-/g, '_')) ?? tierAliases.get(normalizedQuery.replace(/-/g, ''))
  if (tierLabel) return journey.tier === tierLabel

  if (issueCategories.includes(rawQuery)) {
    return rows.some((row) => row.journeyId === journey.id && row.category === rawQuery)
  }

  const journeyRows = rows.filter((row) => row.journeyId === journey.id)
  const haystack = [
    journey.id,
    journey.label,
    journey.tier,
    journey.tierId,
    journey.session,
    journey.route,
    journey.fixture,
    journey.passSignal,
    ...journeyRows.flatMap((row) => [row.result, row.category, row.severity, row.notes, row.nextAction]),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(rawQuery) || normalize(haystack).includes(normalizedQuery)
}

function printSection(label, items, printItem) {
  console.log(`${label}:`)
  if (!items.length) {
    console.log('- None')
    console.log('')
    return
  }

  for (const item of items) printItem(item)
  console.log('')
}

function printRows(label, issueRows) {
  console.log(`${label}:`)
  if (!issueRows.length) {
    console.log('- None')
    console.log('')
    return
  }

  for (const row of issueRows) {
    const journey = journeys.find((item) => item.id === row.journeyId)
    console.log(`- ${row.severity || 'severity missing'} ${row.category || 'category missing'}: ${row.journeyId}`)
    console.log(`  Route: ${journey?.route || row.entryRoute || 'route missing'}`)
    console.log(`  Notes: ${row.notes || 'notes missing'}`)
    if (row.category === 'fixture-gap') {
      console.log(`  Fixture gate: npm run qa:fixture-gate -- ${row.journeyId}`)
      printFixtureAuthCommands(row.journeyId, '  ')
    }
    console.log(`  Next: ${row.nextAction || `npm run qa:kickoff -- ${row.journeyId}`}`)
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

function isHeaderRow(row) {
  return row.date === 'Date' && row.journeyId === 'Journey ID'
}

function isBlankTemplateRow(row) {
  return !row.date && !row.tester && !row.deviceBrowser && !row.accountFixture && !row.journeyId && row.result.includes('pass / fail')
}

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function printFixtureAuthCommands(journeyId, indent) {
  const row = rows.find((item) => item.journeyId === journeyId && item.category === 'fixture-gap' && item.result !== 'pass')
  const journey = journeys.find((item) => item.id === journeyId)
  const authSmokeCommand = getFixtureAuthSmokeCommand(row?.accountFixture || journey?.fixture || '')
  if (!fixtureGateJourneyIds.has(journeyId) && !authSmokeCommand) return
  console.log(`${indent}Auth env: npm run qa:fixture-auth-smoke -- --env`)
  console.log(`${indent}Auth smoke: ${authSmokeCommand || 'npm run qa:fixture-auth-smoke'}`)
}
