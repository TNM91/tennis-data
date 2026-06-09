import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, fixtureGateJourneyIds, sessionByJourneyId } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'

const journeys = customerJourneyDetails.map((journey) => ({
  id: journey.id,
  label: journey.label,
  tier: journey.tier,
  session: sessionByJourneyId.get(journey.id)?.id ?? 'unassigned',
  owner: journey.owner,
  passSignal: journey.passSignal,
}))

const rows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => journeys.some((journey) => journey.id === row.journeyId))

const signoffRows = journeys.map(buildSignoffRow)
const signedOffRows = signoffRows.filter((row) => row.status === 'signed off')
const blockedRows = signoffRows.filter((row) => row.openHighPriorityRows.length)
const missingEvidenceRows = signoffRows.filter((row) => !row.hasPassEvidence || !row.hasScreenshotOrVideo)

console.log('TenAceIQ Customer Journey Signoff Sheet')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log('Use this after daily testing to see what can be called done and what still blocks the week.')
console.log('')
console.log(`Signed off: ${signedOffRows.length}/${signoffRows.length}`)
console.log(`Missing pass/screenshot evidence: ${missingEvidenceRows.length}`)
console.log(`Open p0/p1 blockers: ${blockedRows.length}`)
console.log('')

for (const row of signoffRows) {
  printSignoffRow(row)
}

console.log('Final Gates:')
console.log('- npm run qa:ledger-check')
console.log('- npm run qa:coverage')
console.log('- npm run qa:close-day -- <day1-day5>')
console.log('- npm run qa:launch')
console.log('- npm run verify:closeout:live')
console.log('')
console.log('Closeout rule: signed off means pass evidence, screenshot/video evidence, and no open p0/p1 row for that journey.')

function buildSignoffRow(journey) {
  const journeyRows = rows.filter((row) => row.journeyId === journey.id)
  const passRows = journeyRows.filter((row) => row.result === 'pass')
  const latestRow = journeyRows.at(-1)
  const latestPassRow = passRows.at(-1)
  const hasPassEvidence = passRows.length > 0
  const hasScreenshotOrVideo = passRows.some((row) => row.screenshotOrVideo)
  const openFixtureRows = journeyRows.filter((row) => row.result !== 'pass' && row.category === 'fixture-gap')
  const openHighPriorityRows = journeyRows.filter((row) => row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))
  const missingNextActionRows = journeyRows.filter((row) => row.result !== 'pass' && !row.nextAction)
  const status = hasPassEvidence && hasScreenshotOrVideo && !openHighPriorityRows.length ? 'signed off' : 'not signed off'

  return {
    journey,
    status,
    hasPassEvidence,
    hasScreenshotOrVideo,
    latestRow,
    latestPassRow,
    openFixtureRows,
    openHighPriorityRows,
    missingNextActionRows,
  }
}

function printSignoffRow(row) {
  const { journey } = row

  console.log(`${row.status}: ${journey.label} (${journey.id})`)
  console.log(`  Tier: ${journey.tier}; session: ${journey.session}; owner: ${journey.owner}`)
  console.log(`  Pass signal: ${journey.passSignal}`)
  console.log(`  Latest result: ${row.latestRow?.result || 'missing result row'}`)
  console.log(`  Pass evidence: ${row.hasPassEvidence ? 'yes' : 'no'}`)
  console.log(`  Screenshot/video: ${row.hasScreenshotOrVideo ? row.latestPassRow?.screenshotOrVideo || 'yes' : 'missing'}`)

  if (row.openHighPriorityRows.length) {
    console.log('  Open p0/p1:')
    for (const blocker of row.openHighPriorityRows) {
      console.log(`  - ${blocker.severity} ${blocker.result}: ${blocker.category || 'uncategorized'}; ${blocker.nextAction || 'missing next action'}`)
    }
  }

  if (row.missingNextActionRows.length) {
    console.log(`  Missing next action rows: ${row.missingNextActionRows.length}`)
  }

  if (row.openFixtureRows.length) {
    console.log(`  Fixture gate: npm run qa:fixture-gate -- ${journey.id}`)
    if (fixtureGateJourneyIds.has(journey.id)) {
      console.log('  Auth env: npm run qa:fixture-auth-smoke -- --env')
      console.log('  Auth smoke: npm run qa:fixture-auth-smoke')
    }
  }

  console.log(`  Next: ${getNextCommand(row)}`)
}

function getNextCommand(row) {
  if (row.openHighPriorityRows.length) return `npm run qa:action-list ${row.journey.id}`
  if (row.openFixtureRows.length && fixtureGateJourneyIds.has(row.journey.id)) return `npm run qa:fixture-gate -- ${row.journey.id}; npm run qa:fixture-auth-smoke -- --env; npm run qa:fixture-auth-smoke`
  if (row.openFixtureRows.length) return `npm run qa:fixture-gate -- ${row.journey.id}`
  if (!row.hasPassEvidence) return `npm run qa:journey -- ${row.journey.id}`
  if (!row.hasScreenshotOrVideo) return `npm run qa:evidence-pack -- ${row.journey.session}`
  return `npm run qa:close-day -- ${row.journey.session}`
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
