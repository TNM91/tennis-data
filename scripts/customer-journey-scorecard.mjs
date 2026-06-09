import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, fixtureGateJourneyIds, sessionByJourneyId } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'

const journeys = customerJourneyDetails.map((journey) => ({
  id: journey.id,
  label: journey.label,
  tier: journey.tier,
  session: sessionByJourneyId.get(journey.id)?.id ?? 'unassigned',
}))

const rows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => journeys.some((journey) => journey.id === row.journeyId))

const scorecardRows = journeys.map(buildScorecardRow)
const counts = {
  signedOff: scorecardRows.filter((row) => row.state === 'signed off').length,
  needsPass: scorecardRows.filter((row) => row.state === 'untested' || row.state === 'needs pass').length,
  fixtureBlocked: scorecardRows.filter((row) => row.state === 'fixture blocked').length,
  needsEvidence: scorecardRows.filter((row) => row.state === 'needs evidence').length,
  blocked: scorecardRows.filter((row) => row.state === 'blocked').length,
}

console.log('TenAceIQ Customer Journey Scorecard')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log('Use this as the compact test-week status view before signoff or launch readiness.')
console.log('')
console.log(`Signed off: ${counts.signedOff}/${scorecardRows.length}`)
console.log(`Needs pass: ${counts.needsPass}`)
console.log(`Fixture blocked: ${counts.fixtureBlocked}`)
console.log(`Needs screenshot/video: ${counts.needsEvidence}`)
console.log(`Blocked by open p0/p1: ${counts.blocked}`)
console.log('')
console.log('| Tier | Session | Journey | State | Evidence | Blockers | Next |')
console.log('| --- | --- | --- | --- | --- | --- | --- |')

for (const row of scorecardRows) {
  console.log(
    `| ${row.journey.tier} | ${row.journey.session} | ${row.journey.label} | ${row.state} | ${row.evidenceState} | ${row.openHighPriorityRows.length} | ${row.nextCommand} |`,
  )
}

console.log('')
console.log('Use with:')
console.log('- npm run qa:results')
console.log('- npm run qa:action-list')
console.log('- npm run qa:signoff')
console.log('- npm run qa:launch')
console.log('')
console.log('Closeout rule: use the scorecard for meeting status, then use qa:signoff and qa:launch for final gates.')

function buildScorecardRow(journey) {
  const journeyRows = rows.filter((row) => row.journeyId === journey.id)
  const passRows = journeyRows.filter((row) => row.result === 'pass')
  const hasPass = passRows.length > 0
  const hasScreenshotOrVideo = passRows.some((row) => row.screenshotOrVideo)
  const openFixtureRows = journeyRows.filter((row) => row.result !== 'pass' && row.category === 'fixture-gap')
  const openHighPriorityRows = journeyRows.filter((row) => row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))
  const state = getState({ journeyRows, hasPass, hasScreenshotOrVideo, openFixtureRows, openHighPriorityRows })
  const evidenceState = getEvidenceState({ hasPass, hasScreenshotOrVideo })

  return {
    journey,
    state,
    evidenceState,
    openFixtureRows,
    openHighPriorityRows,
    nextCommand: getNextCommand({ journey, state, openFixtureRows, openHighPriorityRows }),
  }
}

function getState({ journeyRows, hasPass, hasScreenshotOrVideo, openFixtureRows, openHighPriorityRows }) {
  if (openHighPriorityRows.length) return 'blocked'
  if (openFixtureRows.length && !hasPass) return 'fixture blocked'
  if (!journeyRows.length) return 'untested'
  if (!hasPass) return 'needs pass'
  if (!hasScreenshotOrVideo) return 'needs evidence'
  return 'signed off'
}

function getEvidenceState({ hasPass, hasScreenshotOrVideo }) {
  if (hasPass && hasScreenshotOrVideo) return 'pass + evidence'
  if (hasPass) return 'pass only'
  return 'missing'
}

function getNextCommand({ journey, state, openFixtureRows, openHighPriorityRows }) {
  if (openHighPriorityRows.length) return `npm run qa:action-list ${journey.id}`
  if (openFixtureRows.length && fixtureGateJourneyIds.has(journey.id)) return `npm run qa:fixture-gate -- ${journey.id}; npm run qa:fixture-auth-smoke -- --env; npm run qa:fixture-auth-smoke`
  if (openFixtureRows.length) return `npm run qa:fixture-gate -- ${journey.id}`
  if (state === 'untested' || state === 'needs pass') return `npm run qa:journey -- ${journey.id}`
  if (state === 'needs evidence') return `npm run qa:evidence-pack -- ${journey.session}`
  return `npm run qa:close-day -- ${journey.session}`
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
