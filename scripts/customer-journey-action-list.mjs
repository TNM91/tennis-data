import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  fixtureGateJourneyIds,
  getFixtureAuthSmokeCommand,
  journeyById,
  normalizeQaQuery,
  plannedJourneyIds,
  resultRank,
  sessionByJourneyId,
  severityRank,
  tierAliases,
} from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalizeQaQuery(rawQuery)

const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const ledgerRows = source
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map((line, ledgerIndex) => ({ ...parseMarkdownRow(line), ledgerIndex }))
  .filter((row) => plannedJourneyIds.includes(row.journeyId))
const latestPassIndexByJourneyId = buildLatestPassIndexByJourneyId(ledgerRows)
const rows = ledgerRows
  .filter((row) => row.result !== 'pass')
  .filter((row) => !isSupersededByLaterPass(row))
  .filter(matchesQuery)
  .sort(sortActionRows)

const missingNextActionRows = rows.filter((row) => !row.nextAction)

console.log('TenAceIQ Customer Journey Action List')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log('Use this after logging fail, blocked, or needs-follow-up rows so the next fix is explicit.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!rows.length) {
  console.log('Open action rows:')
  console.log('- None')
  console.log('')
  console.log('No logged fail, blocked, or needs-follow-up rows matched. If the ledger is empty, run `npm run qa:ledger` and record real attempts before using this as a sign-off signal.')
  process.exit(0)
}

console.log(`Open action rows: ${rows.length}`)
console.log(`Missing next action: ${missingNextActionRows.length}`)
console.log('')

for (const row of rows) {
  const journey = journeyById.get(row.journeyId)
  console.log(`- ${row.severity || 'unscored'} ${row.result || 'unknown'}: ${row.journeyId}`)
  console.log(`  Tier: ${journey?.tier || 'not mapped'}`)
  console.log(`  Session: ${sessionByJourneyId.get(row.journeyId)?.label || 'not mapped'}`)
  console.log(`  Category: ${row.category || 'uncategorized'}`)
  console.log(`  Fixture: ${row.accountFixture || 'missing fixture'}`)
  console.log(`  Device/browser: ${row.deviceBrowser || 'not recorded'}`)
  console.log(`  Evidence: ${row.screenshotOrVideo || 'missing screenshot/video'}`)
  console.log(`  Notes: ${row.notes || 'none'}`)
  if (row.category === 'fixture-gap') {
    console.log(`  Fixture gate: npm run qa:fixture-gate -- ${row.journeyId}`)
    const authSmokeCommand = getFixtureAuthSmokeCommand(row.accountFixture)
    if (fixtureGateJourneyIds.has(row.journeyId) || authSmokeCommand) {
      console.log('  Auth env: npm run qa:fixture-auth-smoke -- --env')
      console.log(`  Auth smoke: ${authSmokeCommand || 'npm run qa:fixture-auth-smoke'}`)
    }
  }
  console.log(`  Next action: ${row.nextAction || 'missing next action'}`)
}

console.log('')
console.log('Use with:')
console.log('- npm run qa:triage')
console.log('- npm run qa:results')
console.log('- npm run qa:tier-status')
console.log('- npm run qa:session-status')
console.log('- npm run qa:launch')
console.log('')
console.log('Closeout rule: p0/p1 needs a fix or explicit launch decision, and every open row needs a concrete next action before broad testing closes.')

function matchesQuery(row) {
  if (!rawQuery) return true
  const journey = journeyById.get(row.journeyId)
  const session = sessionByJourneyId.get(row.journeyId)
  const tierQuery = tierAliases.get(normalizedQuery)

  if (session?.aliases.includes(normalizedQuery)) return true
  if (tierQuery) return journey?.tier === tierQuery

  return [
    journey?.tier,
    journey?.label,
    session?.id,
    session?.label,
    row.journeyId,
    row.result,
    row.category,
    row.severity,
    row.accountFixture,
    row.entryRoute,
    row.notes,
    row.nextAction,
  ]
    .join(' ')
    .toLowerCase()
    .includes(rawQuery)
}

function sortActionRows(a, b) {
  const severityDelta = (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4)
  if (severityDelta !== 0) return severityDelta

  const resultDelta = (resultRank[a.result] ?? 4) - (resultRank[b.result] ?? 4)
  if (resultDelta !== 0) return resultDelta

  return plannedJourneyIds.indexOf(a.journeyId) - plannedJourneyIds.indexOf(b.journeyId)
}

function buildLatestPassIndexByJourneyId(rows) {
  return rows.reduce((acc, row) => {
    if (row.result !== 'pass') return acc
    acc.set(row.journeyId, Math.max(acc.get(row.journeyId) ?? -1, row.ledgerIndex))
    return acc
  }, new Map())
}

function isSupersededByLaterPass(row) {
  const latestPassIndex = latestPassIndexByJourneyId.get(row.journeyId)
  return latestPassIndex !== undefined && latestPassIndex > row.ledgerIndex
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
