import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const statuses = ['pass', 'fail', 'blocked', 'needs-follow-up']
const severities = ['p0', 'p1', 'p2', 'p3']
const categories = [
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
const plannedJourneys = [
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
const plannedJourneyById = new Map(plannedJourneys.map((journey) => [journey.id, journey]))

const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const ledgerSource = extractResultLedger(source)
const rows = ledgerSource
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map((line, index) => ({ ...parseMarkdownRow(line), rowNumber: index + 1 }))
  .filter((row) => !isHeaderRow(row))
  .filter((row) => !isBlankTemplateRow(row))

const issues = rows.flatMap(validateRow)
const rowsByResult = Object.fromEntries(statuses.map((status) => [status, rows.filter((row) => row.result === status).length]))

console.log('TenAceIQ Customer Journey Ledger Check')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log(`Ledger rows checked: ${rows.length}`)
console.log(`Ledger issues: ${issues.length}`)
console.log('')

console.log('By result:')
for (const status of statuses) {
  console.log(`- ${status}: ${rowsByResult[status]}`)
}

console.log('')

if (!rows.length) {
  console.log('No real ledger rows found yet.')
  console.log('Run `npm run qa:ledger`, paste rows as testing happens, then rerun `npm run qa:ledger-check` before launch readiness.')
  process.exit(0)
}

if (issues.length) {
  console.log('Fix these ledger issues:')
  for (const issue of issues) {
    console.log(`- Row ${issue.rowNumber}: ${issue.message}`)
    console.log(`  Journey: ${issue.journeyId || 'missing journey id'}`)
  }

  console.log('')
  console.log('Ledger check: not ready.')
  console.log('Closeout rule: every recorded row needs valid status, route, fixture, evidence, and action language before it can support launch decisions.')
  process.exit(1)
}

console.log('Ledger check: ready.')
console.log('Every recorded row has a valid journey, status, route, fixture, evidence expectations, and required action fields.')

function validateRow(row) {
  const rowIssues = []
  const plannedJourney = plannedJourneyById.get(row.journeyId)

  if (!row.date) {
    rowIssues.push(buildIssue(row, 'Date is required. Use yyyy-mm-dd.'))
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
    rowIssues.push(buildIssue(row, 'Date must use yyyy-mm-dd.'))
  }

  if (!row.tester) rowIssues.push(buildIssue(row, 'Tester is required.'))
  if (!row.deviceBrowser) rowIssues.push(buildIssue(row, 'Device/browser is required.'))
  if (!row.accountFixture) rowIssues.push(buildIssue(row, 'Account fixture is required.'))

  if (!row.journeyId) {
    rowIssues.push(buildIssue(row, 'Journey ID is required.'))
  } else if (!plannedJourney) {
    rowIssues.push(buildIssue(row, `Unknown journey ID "${row.journeyId}".`))
  }

  if (!row.entryRoute) {
    rowIssues.push(buildIssue(row, 'Entry route is required.'))
  } else if (plannedJourney && row.entryRoute !== plannedJourney.entryRoute) {
    rowIssues.push(buildIssue(row, `Entry route should be ${plannedJourney.entryRoute}.`))
  }

  if (plannedJourney && row.accountFixture && row.accountFixture !== plannedJourney.accountFixture) {
    rowIssues.push(buildIssue(row, `Account fixture should be ${plannedJourney.accountFixture}.`))
  }

  if (!row.result) {
    rowIssues.push(buildIssue(row, 'Result is required.'))
  } else if (!statuses.includes(row.result)) {
    rowIssues.push(buildIssue(row, `Result must be one of: ${statuses.join(', ')}.`))
  }

  if (row.result === 'pass') {
    if (!row.screenshotOrVideo) rowIssues.push(buildIssue(row, 'Pass rows need screenshot/video evidence.'))
    if (row.severity === 'p0' || row.severity === 'p1') rowIssues.push(buildIssue(row, 'Pass rows should not carry open p0/p1 severity.'))
  }

  if (row.result && row.result !== 'pass') {
    if (!row.category) {
      rowIssues.push(buildIssue(row, 'Non-pass rows need an issue category.'))
    } else if (!categories.includes(row.category)) {
      rowIssues.push(buildIssue(row, `Category must be one of: ${categories.join(', ')}.`))
    }

    if (!row.severity) {
      rowIssues.push(buildIssue(row, 'Non-pass rows need severity.'))
    } else if (!severities.includes(row.severity)) {
      rowIssues.push(buildIssue(row, `Severity must be one of: ${severities.join(', ')}.`))
    }

    if (!row.notes) rowIssues.push(buildIssue(row, 'Non-pass rows need a short note.'))
    if (!row.nextAction) rowIssues.push(buildIssue(row, 'Non-pass rows need a concrete next action.'))
  }

  if ((row.result === 'fail' || row.result === 'needs-follow-up') && !row.screenshotOrVideo) {
    rowIssues.push(buildIssue(row, 'Fail and follow-up rows need screenshot/video evidence.'))
  }

  return rowIssues
}

function buildIssue(row, message) {
  return {
    rowNumber: row.rowNumber,
    journeyId: row.journeyId,
    message,
  }
}

function isHeaderRow(row) {
  return row.date === 'Date' && row.journeyId === 'Journey ID'
}

function isBlankTemplateRow(row) {
  return !row.date && !row.tester && !row.deviceBrowser && !row.accountFixture && !row.journeyId && row.result.includes('pass / fail')
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

function extractResultLedger(markdown) {
  const startMarker = '## Result Ledger'
  const endMarker = '## Daily Summary'
  const startIndex = markdown.indexOf(startMarker)

  if (startIndex === -1) return ''

  const endIndex = markdown.indexOf(endMarker, startIndex + startMarker.length)
  return endIndex === -1 ? markdown.slice(startIndex) : markdown.slice(startIndex, endIndex)
}
