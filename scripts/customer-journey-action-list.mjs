import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const plannedJourneys = [
  'player-level-up-mobile-loop',
  'coach-player-assigned-challenge',
  'coach-lesson-support',
  'player-my-lab-return-state',
  'captain-week-flow',
  'league-result-to-public-context',
  'full-court-access-pass',
  'admin-access-and-data-quality',
  'free-public-discovery',
]
const severityRank = {
  p0: 0,
  p1: 1,
  p2: 2,
  p3: 3,
  '': 4,
}
const resultRank = {
  fail: 0,
  blocked: 1,
  'needs-follow-up': 2,
  pass: 3,
  '': 4,
}

const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const rows = source
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneys.includes(row.journeyId))
  .filter((row) => row.result !== 'pass')
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
  console.log(`- ${row.severity || 'unscored'} ${row.result || 'unknown'}: ${row.journeyId}`)
  console.log(`  Category: ${row.category || 'uncategorized'}`)
  console.log(`  Fixture: ${row.accountFixture || 'missing fixture'}`)
  console.log(`  Device/browser: ${row.deviceBrowser || 'not recorded'}`)
  console.log(`  Evidence: ${row.screenshotOrVideo || 'missing screenshot/video'}`)
  console.log(`  Notes: ${row.notes || 'none'}`)
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

  return [
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

  return plannedJourneys.indexOf(a.journeyId) - plannedJourneys.indexOf(b.journeyId)
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
