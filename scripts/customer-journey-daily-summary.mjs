import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawDateFilter = process.argv.slice(2).join(' ').trim()
const statuses = ['pass', 'fail', 'blocked', 'needs-follow-up']
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
  .filter((row) => !rawDateFilter || row.date === rawDateFilter)

console.log('TenAceIQ Customer Journey Daily Summary')
console.log('')
console.log(`Source: ${resultsPath}`)

if (rawDateFilter) {
  console.log(`Date filter: ${rawDateFilter}`)
}

console.log('')

if (!rows.length) {
  console.log('Daily rows recorded: 0')
  console.log('')
  console.log('No logged journey rows matched. Run `npm run qa:ledger`, paste real attempts into the Result Ledger, then rerun this recap after the testing block.')
  process.exit(0)
}

const rowsByDate = groupByDate(rows)

for (const [date, dailyRows] of rowsByDate) {
  const summary = summarizeRows(dailyRows)

  console.log(`Date: ${date || 'missing date'}`)
  console.log(`Rows logged: ${dailyRows.length}`)
  console.log(`Journeys tested: ${summary.journeyIds.size}/${plannedJourneys.length}`)
  console.log(`Open p0/p1: ${summary.openHighPriorityRows.length}`)
  console.log(`Missing next action on non-pass rows: ${summary.missingNextActionRows.length}`)
  console.log('By result:')

  for (const status of statuses) {
    console.log(`- ${status}: ${summary.byStatus[status]}`)
  }

  console.log('Top fix:')
  console.log(`- ${summary.topFix ? formatTopFix(summary.topFix) : 'None'}`)
  console.log('Journey rows:')

  for (const row of dailyRows.sort(sortRows)) {
    console.log(`- ${row.result || 'unknown'}: ${row.journeyId}`)
    console.log(`  Severity: ${row.severity || 'unscored'}`)
    console.log(`  Category: ${row.category || 'uncategorized'}`)
    console.log(`  Evidence: ${row.screenshotOrVideo || 'missing screenshot/video'}`)
    console.log(`  Next action: ${row.nextAction || 'missing next action'}`)
  }

  console.log('')
}

console.log('Use with:')
console.log('- npm run qa:action-list')
console.log('- npm run qa:results')
console.log('- npm run qa:next')
console.log('- npm run qa:launch')
console.log('')
console.log('Closeout rule: end each testing day knowing the pass count, the blocked journeys, and the next fix before opening another broad testing pass.')

function groupByDate(items) {
  const byDate = new Map()

  for (const row of items) {
    const date = row.date || 'missing date'
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date).push(row)
  }

  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function summarizeRows(dailyRows) {
  const byStatus = Object.fromEntries(statuses.map((status) => [status, 0]))
  const journeyIds = new Set()
  const openRows = []
  const openHighPriorityRows = []
  const missingNextActionRows = []

  for (const row of dailyRows) {
    journeyIds.add(row.journeyId)
    if (row.result in byStatus) byStatus[row.result] += 1

    if (row.result !== 'pass') {
      openRows.push(row)
      if (!row.nextAction) missingNextActionRows.push(row)
    }

    if ((row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass') {
      openHighPriorityRows.push(row)
    }
  }

  return {
    byStatus,
    journeyIds,
    openHighPriorityRows,
    missingNextActionRows,
    topFix: [...openHighPriorityRows, ...openRows].filter((row) => row.nextAction).sort(sortRows)[0] ?? openRows.sort(sortRows)[0],
  }
}

function formatTopFix(row) {
  return `${row.severity || 'unscored'} ${row.result || 'unknown'} ${row.journeyId}: ${row.nextAction || 'add next action'}`
}

function sortRows(a, b) {
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
