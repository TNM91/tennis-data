import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    tier: 'Player',
    session: 'day1',
    owner: 'Product + mobile QA',
    passSignal: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    tier: 'Coach',
    session: 'day1',
    owner: 'Coach workflow QA',
    passSignal: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    tier: 'Coach',
    session: 'day2',
    owner: 'Coach content QA',
    passSignal: 'The planner is coach-facing, practical, and connected to the player Level Up path.',
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    tier: 'Player',
    session: 'day2',
    owner: 'Player workspace QA',
    passSignal: 'My Lab makes the player identity, linked profile, and next action clear after refresh.',
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    tier: 'Captain',
    session: 'day3',
    owner: 'Captain workflow QA',
    passSignal: 'Captain can make a weekly decision and produce a useful team-facing update.',
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    tier: 'League',
    session: 'day4',
    owner: 'League operations QA',
    passSignal: 'Coordinator operation and member-facing league context stay connected without exposing private controls.',
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    tier: 'Full-Court',
    session: 'day5',
    owner: 'Access and tier QA',
    passSignal: 'All paid workspaces open cleanly and the user can tell which workspace fits the job.',
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    tier: 'Admin/Internal',
    session: 'day4',
    owner: 'Admin/data QA',
    passSignal: 'Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces.',
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    tier: 'Free',
    session: 'day5',
    owner: 'Public discovery QA',
    passSignal: 'Public tennis intelligence is visible first, and upgrade/data-assist paths are clear.',
  },
]

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

  console.log(`  Next: ${getNextCommand(row)}`)
}

function getNextCommand(row) {
  if (row.openHighPriorityRows.length) return `npm run qa:action-list ${row.journey.id}`
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
