import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    tier: 'Player',
    session: 'day1',
    owner: 'Product + mobile QA',
    backup: 'Coach workflow QA',
    fixture: 'player_plus_linked',
    route: '/player-development/relentless-competitor-4-0/level-up',
    focus: 'Mobile usability, useful tennis work, saved proof, and honest sync state.',
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    tier: 'Coach',
    session: 'day1',
    owner: 'Coach workflow QA',
    backup: 'Product + mobile QA',
    fixture: 'coach_primary',
    route: '/coach',
    focus: 'Coach assignment, player completion proof, and coach review loop.',
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    tier: 'Coach',
    session: 'day2',
    owner: 'Coach content QA',
    backup: 'Product + mobile QA',
    fixture: 'coach_primary',
    route: '/player-development/relentless-competitor-4-0/coach-planner',
    focus: 'Coach planner usefulness, lesson support, and alignment to player Level Up work.',
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    tier: 'Player',
    session: 'day2',
    owner: 'Player workspace QA',
    backup: 'Access and tier QA',
    fixture: 'player_plus_linked',
    route: '/mylab',
    focus: 'Player return state, identity clarity, linked profile, and next action.',
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    tier: 'Captain',
    session: 'day3',
    owner: 'Captain workflow QA',
    backup: 'Access and tier QA',
    fixture: 'captain_primary',
    route: '/captain',
    focus: 'Captain decisions, weekly lineup work, readiness, and team-facing output.',
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    tier: 'League',
    session: 'day4',
    owner: 'League operations QA',
    backup: 'Admin/data QA',
    fixture: 'league_coordinator',
    route: '/league-coordinator',
    focus: 'Coordinator operation, public/member context, and no private control leakage.',
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    tier: 'Full-Court',
    session: 'day5',
    owner: 'Access and tier QA',
    backup: 'Player workspace QA',
    fixture: 'full_court_operator',
    route: '/pricing',
    focus: 'Paid workspace access, stale lock removal, and clear role navigation.',
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    tier: 'Admin/Internal',
    session: 'day4',
    owner: 'Admin/data QA',
    backup: 'League operations QA',
    fixture: 'admin_test',
    route: '/admin/access',
    focus: 'Access repair, data quality, safe fixtures, and reflected product state.',
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    tier: 'Free',
    session: 'day5',
    owner: 'Public discovery QA',
    backup: 'Access and tier QA',
    fixture: 'free_viewer',
    route: '/explore',
    focus: 'Public tennis intelligence, useful free discovery, and clean upgrade handoff.',
  },
]

const rows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => journeys.some((journey) => journey.id === row.journeyId))

const ownerRows = journeys.map(buildOwnerRow).filter(matchesQuery)
const ownerGroups = groupByOwner(ownerRows)
const openOwnerRows = ownerRows.filter((row) => row.state !== 'signed off')
const blockedOwnerRows = ownerRows.filter((row) => row.openHighPriorityRows.length)

console.log('TenAceIQ Customer Journey Owner Board')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log('Use this during test week to keep every journey, blocker, and stale evidence gap owned by a named QA lane.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!ownerRows.length) {
  console.log(`No owner row matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:owner-board -- <owner | tier | day1-day5 | journey | route | fixture>')
  process.exit(1)
}

console.log(`Journeys visible: ${ownerRows.length}`)
console.log(`Open owner rows: ${openOwnerRows.length}`)
console.log(`Open p0/p1 owner blockers: ${blockedOwnerRows.length}`)
console.log('')

console.log('Owner load:')
for (const [owner, items] of ownerGroups) {
  const openItems = items.filter((item) => item.state !== 'signed off')
  const blockers = items.reduce((count, item) => count + item.openHighPriorityRows.length, 0)
  console.log(`- ${owner}: ${items.length} journeys; open ${openItems.length}; p0/p1 ${blockers}`)
}

console.log('')
console.log('Journey ownership:')
for (const row of ownerRows) printOwnerRow(row)

console.log('Use with:')
console.log('- npm run qa:action-list')
console.log('- npm run qa:tester-handoff -- <day1-day5>')
console.log('- npm run qa:change-impact -- --files=<comma-separated-files>')
console.log('- npm run qa:scorecard')
console.log('- npm run qa:signoff')
console.log('')
console.log('Owner rule: every open row should have one owner lane, one next action, and one proving journey before the testing day closes.')

function buildOwnerRow(journey) {
  const journeyRows = rows.filter((row) => row.journeyId === journey.id)
  const passRows = journeyRows.filter((row) => row.result === 'pass')
  const latestRow = journeyRows.at(-1)
  const hasPass = passRows.length > 0
  const hasEvidence = passRows.some((row) => row.screenshotOrVideo)
  const openRows = journeyRows.filter((row) => row.result && row.result !== 'pass')
  const openHighPriorityRows = openRows.filter((row) => row.severity === 'p0' || row.severity === 'p1')
  const missingNextActionRows = openRows.filter((row) => !row.nextAction)
  const state = getState({ journeyRows, hasPass, hasEvidence, openHighPriorityRows })

  return {
    journey,
    latestRow,
    state,
    hasPass,
    hasEvidence,
    openRows,
    openHighPriorityRows,
    missingNextActionRows,
  }
}

function printOwnerRow(row) {
  const { journey } = row

  console.log(`- ${row.state}: ${journey.id}`)
  console.log(`  Owner: ${journey.owner}; backup: ${journey.backup}`)
  console.log(`  Tier/session: ${journey.tier} / ${journey.session}`)
  console.log(`  Route: ${journey.route}`)
  console.log(`  Fixture: ${journey.fixture}`)
  console.log(`  Focus: ${journey.focus}`)
  console.log(`  Latest result: ${row.latestRow?.result || 'missing result row'}`)
  console.log(`  Open rows: ${row.openRows.length}; open p0/p1: ${row.openHighPriorityRows.length}; missing next action: ${row.missingNextActionRows.length}`)
  console.log(`  Next: ${getNextCommand(row)}`)

  if (row.openHighPriorityRows.length) {
    console.log('  Priority blockers:')
    for (const blocker of row.openHighPriorityRows) {
      console.log(`  - ${blocker.severity} ${blocker.result}: ${blocker.category || 'uncategorized'}; ${blocker.nextAction || 'missing next action'}`)
    }
  }
}

function getState({ journeyRows, hasPass, hasEvidence, openHighPriorityRows }) {
  if (openHighPriorityRows.length) return 'blocked'
  if (!journeyRows.length) return 'unassigned result'
  if (!hasPass) return 'needs pass'
  if (!hasEvidence) return 'needs evidence'
  return 'signed off'
}

function getNextCommand(row) {
  if (row.openHighPriorityRows.length) return `npm run qa:action-list ${row.journey.id}`
  if (row.state === 'unassigned result' || row.state === 'needs pass') return `npm run qa:journey -- ${row.journey.id}`
  if (row.state === 'needs evidence') return `npm run qa:evidence-pack -- ${row.journey.session}`
  return `npm run qa:close-day -- ${row.journey.session}`
}

function groupByOwner(items) {
  const groups = new Map()

  for (const item of items) {
    const existing = groups.get(item.journey.owner) ?? []
    existing.push(item)
    groups.set(item.journey.owner, existing)
  }

  return [...groups.entries()]
}

function matchesQuery(row) {
  if (!rawQuery) return true

  return [
    row.journey.id,
    row.journey.label,
    row.journey.tier,
    row.journey.session,
    row.journey.owner,
    row.journey.backup,
    row.journey.fixture,
    row.journey.route,
    row.journey.focus,
    row.state,
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
