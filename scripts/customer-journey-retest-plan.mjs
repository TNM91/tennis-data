import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = rawQuery.replace(/\s+/g, '').replace('-', '')

const sessions = [
  {
    id: 'day1',
    aliases: ['1', 'day1', 'trustloop'],
    label: 'Day 1 - Trust Loop',
    journeyIds: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
  },
  {
    id: 'day2',
    aliases: ['2', 'day2', 'playercoach'],
    label: 'Day 2 - Player And Coach Depth',
    journeyIds: ['coach-lesson-support', 'player-my-lab-return-state'],
  },
  {
    id: 'day3',
    aliases: ['3', 'day3', 'captain'],
    label: 'Day 3 - Captain Week',
    journeyIds: ['captain-week-flow'],
  },
  {
    id: 'day4',
    aliases: ['4', 'day4', 'leagueadmin'],
    label: 'Day 4 - League And Admin',
    journeyIds: ['league-result-to-public-context', 'admin-access-and-data-quality'],
  },
  {
    id: 'day5',
    aliases: ['5', 'day5', 'regression'],
    label: 'Day 5 - Full-Court And Free/Public Regression',
    journeyIds: ['full-court-access-pass', 'free-public-discovery'],
  },
]
const journeyDetails = [
  {
    id: 'player-level-up-mobile-loop',
    entryRoute: '/player-development/relentless-competitor-4-0/level-up',
    accountFixture: 'player_plus_linked',
  },
  {
    id: 'coach-player-assigned-challenge',
    entryRoute: '/coach',
    accountFixture: 'coach_primary',
  },
  {
    id: 'coach-lesson-support',
    entryRoute: '/player-development/relentless-competitor-4-0/coach-planner',
    accountFixture: 'coach_primary',
  },
  {
    id: 'player-my-lab-return-state',
    entryRoute: '/mylab',
    accountFixture: 'player_plus_linked',
  },
  {
    id: 'captain-week-flow',
    entryRoute: '/captain',
    accountFixture: 'captain_primary',
  },
  {
    id: 'league-result-to-public-context',
    entryRoute: '/league-coordinator',
    accountFixture: 'league_coordinator',
  },
  {
    id: 'full-court-access-pass',
    entryRoute: '/pricing',
    accountFixture: 'full_court_operator',
  },
  {
    id: 'admin-access-and-data-quality',
    entryRoute: '/admin/access',
    accountFixture: 'admin_test',
  },
  {
    id: 'free-public-discovery',
    entryRoute: '/explore',
    accountFixture: 'free_viewer',
  },
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
const journeyById = new Map(journeyDetails.map((journey) => [journey.id, journey]))
const sessionByJourneyId = new Map(sessions.flatMap((session) => session.journeyIds.map((journeyId) => [journeyId, session])))
const plannedJourneyIds = journeyDetails.map((journey) => journey.id)

const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const rows = extractResultLedger(source)
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))
  .filter(matchesQuery)

const passJourneyIds = new Set(rows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
const openRows = rows.filter((row) => row.result && row.result !== 'pass').sort(sortRows)
const missingPassJourneyIds = plannedJourneyIds.filter((journeyId) => !passJourneyIds.has(journeyId)).filter(matchesJourneyQuery)
const openHighPriorityRows = openRows.filter((row) => row.severity === 'p0' || row.severity === 'p1')

console.log('TenAceIQ Customer Journey Retest Plan')
console.log('')
console.log(`Source: ${resultsPath}`)
if (rawQuery) console.log(`Filter: ${rawQuery}`)
console.log(`Open retest rows: ${openRows.length}`)
console.log(`Open p0/p1 retests: ${openHighPriorityRows.length}`)
console.log(`Journeys missing pass evidence: ${missingPassJourneyIds.length}`)
console.log('')

if (!rows.length && !missingPassJourneyIds.length) {
  console.log('No retest work matched this filter.')
  console.log('')
  console.log('Use `npm run qa:retest`, `npm run qa:retest -- day1`, or `npm run qa:retest -- <journey-id>` after logging results.')
  process.exit(0)
}

if (openRows.length) {
  console.log('Retest open rows first:')
  for (const row of openRows) {
    const session = sessionByJourneyId.get(row.journeyId)
    console.log(`- ${row.severity || 'unscored'} ${row.result}: ${row.journeyId}`)
    console.log(`  Session: ${session?.id ?? 'unknown'}${session ? ` (${session.label})` : ''}`)
    console.log(`  Category: ${row.category || 'uncategorized'}`)
    console.log(`  Evidence: ${row.screenshotOrVideo || 'missing screenshot/video'}`)
    console.log(`  Next action: ${row.nextAction || 'missing next action'}`)
    console.log(`  Commands: npm run qa:journey -- ${row.journeyId}; npm run qa:session-status -- ${session?.id ?? '<day>'}`)
  }
  console.log('')
}

if (missingPassJourneyIds.length) {
  console.log('Still needs pass evidence:')
  for (const journeyId of missingPassJourneyIds) {
    const journey = journeyById.get(journeyId)
    const session = sessionByJourneyId.get(journeyId)
    console.log(`- ${journeyId}`)
    console.log(`  Session: ${session?.id ?? 'unknown'}${session ? ` (${session.label})` : ''}`)
    console.log(`  Route: ${journey?.entryRoute ?? 'missing route'}`)
    console.log(`  Fixture: ${journey?.accountFixture ?? 'missing fixture'}`)
    console.log(`  Commands: npm run qa:journey -- ${journeyId}; npm run qa:session-ledger -- ${session?.id ?? '<day>'}`)
  }
  console.log('')
}

console.log('Use with:')
console.log('- npm run qa:ledger-check')
console.log('- npm run qa:results')
console.log('- npm run qa:action-list')
console.log('- npm run qa:daily-summary -- <yyyy-mm-dd>')
console.log('- npm run qa:launch')
console.log('')
console.log('Closeout rule: a fix is not closed until the same journey has fresh pass evidence and no newer open p0/p1 row.')

function matchesQuery(row) {
  if (!rawQuery) return true
  const session = sessionByJourneyId.get(row.journeyId)

  return [
    row.journeyId,
    row.result,
    row.category,
    row.severity,
    row.accountFixture,
    row.entryRoute,
    row.notes,
    row.nextAction,
    session?.id,
    session?.label,
    ...(session?.aliases ?? []),
  ]
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace('-', '')
    .includes(normalizedQuery)
}

function matchesJourneyQuery(journeyId) {
  if (!rawQuery) return true
  const journey = journeyById.get(journeyId)
  const session = sessionByJourneyId.get(journeyId)

  return [
    journeyId,
    journey?.entryRoute,
    journey?.accountFixture,
    session?.id,
    session?.label,
    ...(session?.aliases ?? []),
  ]
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace('-', '')
    .includes(normalizedQuery)
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
