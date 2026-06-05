import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()

const journeys = [
  { id: 'player-level-up-mobile-loop', tier: 'Player', session: 'day1', route: '/player-development/relentless-competitor-4-0/level-up' },
  { id: 'coach-player-assigned-challenge', tier: 'Coach', session: 'day1', route: '/coach' },
  { id: 'coach-lesson-support', tier: 'Coach', session: 'day2', route: '/player-development/relentless-competitor-4-0/coach-planner' },
  { id: 'player-my-lab-return-state', tier: 'Player', session: 'day2', route: '/mylab' },
  { id: 'captain-week-flow', tier: 'Captain', session: 'day3', route: '/captain' },
  { id: 'league-result-to-public-context', tier: 'League', session: 'day4', route: '/league-coordinator' },
  { id: 'full-court-access-pass', tier: 'Full-Court', session: 'day5', route: '/pricing' },
  { id: 'admin-access-and-data-quality', tier: 'Admin/Internal', session: 'day4', route: '/admin/access' },
  { id: 'free-public-discovery', tier: 'Free', session: 'day5', route: '/explore' },
]

const launchBlockingCategories = new Set(['sync-gap', 'access-gap', 'gating-gap', 'data-propagation-gap', 'product-logic'])
const qualityCategories = new Set(['mobile-ux-gap', 'content-quality-gap', 'return-state-gap', 'visual-polish'])
const fixtureCategories = new Set(['fixture-gap'])

const rows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => journeys.some((journey) => journey.id === row.journeyId))
  .filter(matchesQuery)

const visibleJourneys = journeys.filter((journey) => matchesJourney(journey))
const launchBlockers = rows.filter(isLaunchBlocker)
const testBlockers = rows.filter((row) => row.result !== 'pass' && fixtureCategories.has(row.category))
const qualityFollowUps = rows.filter((row) => row.result !== 'pass' && qualityCategories.has(row.category))
const unclassifiedOpenRows = rows.filter((row) => row.result !== 'pass' && !isLaunchBlocker(row) && !fixtureCategories.has(row.category) && !qualityCategories.has(row.category))
const missingPassJourneys = visibleJourneys.filter((journey) => !rows.some((row) => row.journeyId === journey.id && row.result === 'pass'))
const missingEvidenceJourneys = visibleJourneys.filter((journey) => rows.some((row) => row.journeyId === journey.id && row.result === 'pass') && !rows.some((row) => row.journeyId === journey.id && row.result === 'pass' && row.screenshotOrVideo))

console.log('TenAceIQ Launch Blocker Board')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log('Use this before qa:launch to separate product launch blockers, fixture/test blockers, quality follow-ups, and missing evidence.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

console.log('Readiness totals:')
console.log(`- Visible journeys: ${visibleJourneys.length}`)
console.log(`- Product launch blockers: ${launchBlockers.length}`)
console.log(`- Fixture/test blockers: ${testBlockers.length}`)
console.log(`- Quality follow-ups: ${qualityFollowUps.length}`)
console.log(`- Unclassified open rows: ${unclassifiedOpenRows.length}`)
console.log(`- Missing pass journeys: ${missingPassJourneys.length}`)
console.log(`- Pass rows missing screenshot/video: ${missingEvidenceJourneys.length}`)
console.log('')

printSection({
  title: 'Product launch blockers',
  rows: launchBlockers,
  empty: 'None logged.',
  fallbackCommand: 'npm run qa:action-list',
})

printSection({
  title: 'Fixture/test blockers',
  rows: testBlockers,
  empty: 'None logged.',
  fallbackCommand: 'npm run qa:fixture-status -- <day1-day5>',
})

printSection({
  title: 'Quality follow-ups',
  rows: qualityFollowUps,
  empty: 'None logged.',
  fallbackCommand: 'npm run qa:retest -- <day-or-journey>',
})

printSection({
  title: 'Unclassified open rows',
  rows: unclassifiedOpenRows,
  empty: 'None logged.',
  fallbackCommand: 'npm run qa:issue',
})

console.log('Missing pass evidence:')
if (missingPassJourneys.length) {
  for (const journey of missingPassJourneys) {
    console.log(`- ${journey.tier} ${journey.session}: ${journey.id}`)
    console.log(`  Route: ${journey.route}`)
    console.log(`  Next: npm run qa:journey -- ${journey.id}`)
  }
} else {
  console.log('- None')
}

console.log('')
console.log('Pass rows missing screenshot/video:')
if (missingEvidenceJourneys.length) {
  for (const journey of missingEvidenceJourneys) {
    console.log(`- ${journey.tier} ${journey.session}: ${journey.id}`)
    console.log(`  Next: npm run qa:evidence-pack -- ${journey.session}`)
  }
} else {
  console.log('- None')
}

console.log('')
console.log('Use with:')
console.log('- npm run qa:scorecard')
console.log('- npm run qa:signoff')
console.log('- npm run qa:launch')
console.log('- npm run qa:change-impact -- --files=<comma-separated-files>')
console.log('- npm run verify:closeout:live')
console.log('')
console.log('Launch board rule: product blockers require a fix or explicit launch decision; fixture blockers require setup and retest; quality follow-ups need a priority call; missing evidence means the journey is not signed off yet.')

function isLaunchBlocker(row) {
  return row.severity === 'p0' || row.severity === 'p1' || launchBlockingCategories.has(row.category)
}

function printSection({ title, rows: sectionRows, empty, fallbackCommand }) {
  console.log(`${title}:`)

  if (!sectionRows.length) {
    console.log(`- ${empty}`)
    console.log(`  Next: ${fallbackCommand}`)
    console.log('')
    return
  }

  for (const row of sectionRows) {
    console.log(`- ${row.severity || 'unscored'} ${row.result}: ${row.journeyId}`)
    console.log(`  Category: ${row.category || 'uncategorized'}`)
    console.log(`  Route: ${row.entryRoute || 'missing route'}`)
    console.log(`  Notes: ${row.notes || 'missing notes'}`)
    console.log(`  Next: ${row.nextAction || fallbackCommand}`)
  }

  console.log('')
}

function matchesJourney(journey) {
  if (!rawQuery) return true

  return [journey.id, journey.tier, journey.session, journey.route].join(' ').toLowerCase().includes(rawQuery)
}

function matchesQuery(row) {
  if (!rawQuery) return true
  const journey = journeys.find((item) => item.id === row.journeyId)

  return [
    journey?.tier,
    journey?.session,
    journey?.route,
    row.date,
    row.tester,
    row.deviceBrowser,
    row.accountFixture,
    row.journeyId,
    row.entryRoute,
    row.result,
    row.category,
    row.severity,
    row.screenshotOrVideo,
    row.notes,
    row.nextAction,
  ]
    .join(' ')
    .toLowerCase()
    .includes(rawQuery)
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
