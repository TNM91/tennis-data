import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const options = parseArgs(process.argv.slice(2))
const rawQuery = options.session.trim().toLowerCase()
const normalizedQuery = rawQuery.replace(/\s+/g, '').replace('-', '')

const sessions = [
  {
    id: 'day1',
    aliases: ['1', 'day1', 'trustloop'],
    label: 'Day 1',
    focus: 'Trust Loop',
    question: 'Can player proof and coach assignment close the trust loop without sync or mobile confusion?',
    journeyIds: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
    fixtures: ['player_plus_linked', 'coach_primary', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
  },
  {
    id: 'day2',
    aliases: ['2', 'day2', 'playercoach'],
    label: 'Day 2',
    focus: 'Player And Coach Depth',
    question: 'Can recent work become a useful next lesson and a clear player return state?',
    journeyIds: ['coach-lesson-support', 'player-my-lab-return-state'],
    fixtures: ['coach_primary', 'player_plus_linked', 'linked-player-profile', 'level-up-assignment'],
  },
  {
    id: 'day3',
    aliases: ['3', 'day3', 'captain'],
    label: 'Day 3',
    focus: 'Captain Week',
    question: 'Can a captain move from availability and context to lineup choice and team-facing communication?',
    journeyIds: ['captain-week-flow'],
    fixtures: ['captain_primary', 'captain-team-week'],
  },
  {
    id: 'day4',
    aliases: ['4', 'day4', 'leagueadmin'],
    label: 'Day 4',
    focus: 'League And Admin',
    question: 'Can operations, public/member context, access repair, and data review stay fixture-safe and connected?',
    journeyIds: ['league-result-to-public-context', 'admin-access-and-data-quality'],
    fixtures: ['league_coordinator', 'league-week', 'admin_test', 'admin-access-repair', 'data-assist-upload'],
  },
  {
    id: 'day5',
    aliases: ['5', 'day5', 'regression'],
    label: 'Day 5',
    focus: 'Full-Court And Free/Public Regression',
    question: 'Can multi-role access and free discovery work without stale locks or premature upgrade pressure?',
    journeyIds: ['full-court-access-pass', 'free-public-discovery'],
    fixtures: ['full_court_operator', 'full-court-access-state', 'free_viewer', 'data-assist-upload'],
  },
]

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    tier: 'player',
    risk: 'critical',
    entryRoute: '/player-development/relentless-competitor-4-0/level-up',
    accountFixture: 'player_plus_linked',
    passSignal: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
    proofGapCount: 1,
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    tier: 'coach',
    risk: 'critical',
    entryRoute: '/coach',
    accountFixture: 'coach_primary',
    passSignal: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
    proofGapCount: 2,
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    tier: 'coach',
    risk: 'high',
    entryRoute: '/player-development/relentless-competitor-4-0/coach-planner',
    accountFixture: 'coach_primary',
    passSignal: 'The planner is coach-facing, practical, and connected to the player Level Up path.',
    proofGapCount: 1,
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    tier: 'player',
    risk: 'high',
    entryRoute: '/mylab',
    accountFixture: 'player_plus_linked',
    passSignal: 'My Lab makes the player identity, linked profile, and next action clear after refresh.',
    proofGapCount: 1,
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    tier: 'captain',
    risk: 'high',
    entryRoute: '/captain',
    accountFixture: 'captain_primary',
    passSignal: 'Captain can make a weekly decision and produce a useful team-facing update.',
    proofGapCount: 2,
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    tier: 'league',
    risk: 'high',
    entryRoute: '/league-coordinator',
    accountFixture: 'league_coordinator',
    passSignal: 'Coordinator operation and member-facing league context stay connected without exposing private controls.',
    proofGapCount: 1,
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    tier: 'full-court',
    risk: 'medium',
    entryRoute: '/pricing',
    accountFixture: 'full_court_operator',
    passSignal: 'All paid workspaces open cleanly and the user can tell which workspace fits the job.',
    proofGapCount: 1,
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    tier: 'admin',
    risk: 'high',
    entryRoute: '/admin/access',
    accountFixture: 'admin_test',
    passSignal: 'Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces.',
    proofGapCount: 3,
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    tier: 'free',
    risk: 'medium',
    entryRoute: '/explore',
    accountFixture: 'free_viewer',
    passSignal: 'Public tennis intelligence is visible first, and upgrade/data-assist paths are clear.',
    proofGapCount: 1,
  },
]

const journeyById = new Map(journeys.map((journey) => [journey.id, journey]))
const ledgerRows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => journeyById.has(row.journeyId))

const session = sessions.find((item) => item.aliases.includes(normalizedQuery)) ?? chooseNextSession()
const rankedSessionJourneys = session.journeyIds
  .map((journeyId) => scoreJourney(journeyById.get(journeyId)))
  .filter(Boolean)
  .sort((a, b) => b.score - a.score)
const topRisk = rankedSessionJourneys[0]

console.log('TenAceIQ Customer Journey Morning Brief')
console.log('')

if (!session) {
  console.log('Usage: npm run qa:brief -- <day1 | day2 | day3 | day4 | day5>')
  console.log('       npm run qa:brief -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>')
  process.exit(1)
}

console.log(`${session.label}: ${session.focus}`)
console.log(`Question: ${session.question}`)
if (options.date || options.tester || options.deviceBrowser) {
  console.log(`Defaults: date=${options.date || 'blank'}, tester=${options.tester || 'blank'}, device/browser=${options.deviceBrowser || 'blank'}`)
}
console.log('')

console.log('Start Here:')
console.log(`- Top risk: ${topRisk ? `${topRisk.journey.label} (${topRisk.journey.id})` : 'No ranked journey found'}`)
console.log(`- Field card: npm run qa:journey -- ${topRisk?.journey.id ?? session.journeyIds[0]}`)
console.log(`- Session card: npm run qa:day -- ${session.id}${formatDefaultsForCommand()}`)
console.log(`- Risk board: npm run qa:risk-board -- ${session.id}`)
console.log('')

console.log('Fixture Check:')
for (const fixture of session.fixtures) console.log(`- ${fixture}`)
console.log('')

console.log('Journeys To Walk:')
for (const item of rankedSessionJourneys) {
  console.log(`- ${item.state}: ${item.journey.label}`)
  console.log(`  Route: ${item.journey.entryRoute}`)
  console.log(`  Pass: ${item.journey.passSignal}`)
}
console.log('')

console.log('Paste-ready ledger rows:')
console.log('| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
for (const journeyId of session.journeyIds) {
  const journey = journeyById.get(journeyId)
  if (!journey) continue

  console.log(
    `| ${formatCell(options.date)} | ${formatCell(options.tester)} | ${formatCell(options.deviceBrowser)} | ${journey.accountFixture} | ${journey.id} | ${journey.entryRoute} | needs-follow-up |  |  |  |  |  |`
  )
}
console.log('')

console.log('End The Block:')
console.log('- npm run qa:ledger-check')
console.log(`- npm run qa:session-status -- ${session.id}`)
console.log(options.date ? `- npm run qa:daily-summary -- ${options.date}` : '- npm run qa:daily-summary -- <yyyy-mm-dd>')
console.log(`- npm run qa:close-day -- ${session.id}${options.date ? ` --date=${options.date}` : ''}`)
console.log(`- npm run qa:retest -- ${session.id}`)
console.log('')
console.log('Closeout rule: begin with one high-risk proof gap, end with a ledger check and a close-day gate.')

function chooseNextSession() {
  const passedJourneyIds = new Set(ledgerRows.filter((row) => row.result === 'pass').map((row) => row.journeyId))

  return sessions.find((item) => item.journeyIds.some((journeyId) => !passedJourneyIds.has(journeyId))) ?? sessions[0]
}

function scoreJourney(journey) {
  if (!journey) return null

  const rows = ledgerRows.filter((row) => row.journeyId === journey.id)
  const hasPass = rows.some((row) => row.result === 'pass')
  const hasEvidence = rows.some((row) => row.screenshotOrVideo)
  const hasOpenHighPriority = rows.some((row) => row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))
  const score =
    (hasOpenHighPriority ? 120 : 0) +
    (!hasPass ? 40 : 0) +
    (!hasEvidence ? 15 : 0) +
    (!rows.length ? 20 : 0) +
    riskScore(journey.risk) +
    journey.proofGapCount * 8
  const state = hasOpenHighPriority ? 'blocked' : !rows.length ? 'untested' : !hasPass ? 'needs pass' : !hasEvidence ? 'needs evidence' : 'pass logged'

  return { journey, score, state }
}

function riskScore(risk) {
  if (risk === 'critical') return 70
  if (risk === 'high') return 45
  return 20
}

function parseArgs(args) {
  const parsed = {
    session: '',
    date: '',
    tester: '',
    deviceBrowser: '',
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? ''

    if (!arg.startsWith('--')) {
      if (!parsed.session) parsed.session = arg
      continue
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=')
    const key = rawKey.trim().toLowerCase()
    const nextValue = args[index + 1] ?? ''
    const value = inlineValue ?? (nextValue.startsWith('--') ? '' : nextValue)

    if (inlineValue === undefined && value) index += 1

    if (key === 'date') parsed.date = value
    if (key === 'tester') parsed.tester = value
    if (key === 'device' || key === 'browser' || key === 'device-browser') parsed.deviceBrowser = value
  }

  return parsed
}

function formatDefaultsForCommand() {
  const parts = []
  if (options.date) parts.push(`--date=${options.date}`)
  if (options.tester) parts.push(`--tester=${options.tester}`)
  if (options.deviceBrowser) parts.push(`--device="${options.deviceBrowser}"`)

  return parts.length ? ` ${parts.join(' ')}` : ''
}

function formatCell(value) {
  return value.trim().replace(/\|/g, '/')
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
