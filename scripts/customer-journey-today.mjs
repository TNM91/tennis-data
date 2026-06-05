import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const options = parseArgs(process.argv.slice(2))
const date = options.date || 'yyyy-mm-dd'
const tester = options.tester || '<name>'
const resultsPath = 'docs/customer-journey-test-results.md'

const deviceProfiles = {
  phone: {
    label: 'Phone',
    value: 'phone',
    why: 'Proves the fast, on-the-go version of the journey: tap targets, short copy, and no hidden next action.',
  },
  tablet: {
    label: 'Tablet / iPad',
    value: 'ipad',
    why: 'Proves court-side lesson, planner, and review workflows with more room but still touch-first behavior.',
  },
  desktop: {
    label: 'Desktop',
    value: 'desktop',
    why: 'Proves full-context review, admin, lineup, and coordinator workflows.',
  },
}

const sessions = [
  {
    id: 'day1',
    aliases: ['1', 'day1', 'trustloop', 'trust-loop'],
    label: 'Day 1',
    focus: 'Trust Loop',
    question: 'Can player proof and coach assignment close the trust loop without sync or mobile confusion?',
    fixtures: ['player_plus_linked', 'coach_primary', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
    journeys: [
      {
        id: 'player-level-up-mobile-loop',
        route: '/player-development/relentless-competitor-4-0/level-up',
        fixture: 'player_plus_linked',
        devices: ['phone', 'tablet'],
        proof: 'Active training, saved proof, and next action are obvious on the device being tested.',
      },
      {
        id: 'coach-player-assigned-challenge',
        route: '/coach',
        fixture: 'coach_primary',
        devices: ['phone', 'tablet', 'desktop'],
        proof: 'Coach assignment and player proof close the loop across roles without manual cleanup.',
      },
    ],
  },
  {
    id: 'day2',
    aliases: ['2', 'day2', 'playercoach', 'player-coach'],
    label: 'Day 2',
    focus: 'Player And Coach Depth',
    question: 'Can recent work become a useful next lesson and a clear player return state?',
    fixtures: ['coach_primary', 'player_plus_linked', 'linked-player-profile', 'level-up-assignment'],
    journeys: [
      {
        id: 'coach-lesson-support',
        route: '/player-development/relentless-competitor-4-0/coach-planner',
        fixture: 'coach_primary',
        devices: ['tablet', 'desktop'],
        proof: 'Coach planner supports the player journey and assignment handoff.',
      },
      {
        id: 'player-my-lab-return-state',
        route: '/mylab',
        fixture: 'player_plus_linked',
        devices: ['phone', 'desktop'],
        proof: 'Player can return later and understand what changed and what to do next.',
      },
    ],
  },
  {
    id: 'day3',
    aliases: ['3', 'day3', 'captain'],
    label: 'Day 3',
    focus: 'Captain Week',
    question: 'Can a captain move from availability and context to lineup choice and team-facing communication?',
    fixtures: ['captain_primary', 'captain-team-week'],
    journeys: [
      {
        id: 'captain-week-flow',
        route: '/captain',
        fixture: 'captain_primary',
        devices: ['phone', 'tablet', 'desktop'],
        proof: 'Captain can update context, make a lineup decision, and produce a useful team-facing update.',
      },
    ],
  },
  {
    id: 'day4',
    aliases: ['4', 'day4', 'leagueadmin', 'league-admin'],
    label: 'Day 4',
    focus: 'League And Admin',
    question: 'Can operations, public/member context, access repair, and data review stay fixture-safe and connected?',
    fixtures: ['league_coordinator', 'league-week', 'admin_test', 'admin-access-repair', 'data-assist-upload'],
    journeys: [
      {
        id: 'league-result-to-public-context',
        route: '/league-coordinator',
        fixture: 'league_coordinator',
        devices: ['tablet', 'desktop'],
        proof: 'Coordinator operations connect to public/member context without exposing private controls.',
      },
      {
        id: 'admin-access-and-data-quality',
        route: '/admin/access',
        fixture: 'admin_test',
        devices: ['desktop'],
        proof: 'Access/data repair is fixture-safe, traceable, and reflected in the affected product surface.',
      },
    ],
  },
  {
    id: 'day5',
    aliases: ['5', 'day5', 'regression'],
    label: 'Day 5',
    focus: 'Full-Court And Free/Public Regression',
    question: 'Can multi-role access and free discovery work without stale locks or premature upgrade pressure?',
    fixtures: ['full_court_operator', 'full-court-access-state', 'free_viewer', 'data-assist-upload'],
    journeys: [
      {
        id: 'full-court-access-pass',
        route: '/pricing',
        fixture: 'full_court_operator',
        devices: ['phone', 'desktop'],
        proof: 'Paid workspaces open cleanly and role fit is clear.',
      },
      {
        id: 'free-public-discovery',
        route: '/explore',
        fixture: 'free_viewer',
        devices: ['phone', 'desktop'],
        proof: 'Free user gets useful tennis intelligence before upgrade or data-assist handoff.',
      },
    ],
  },
]

const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const rows = extractResultLedger(source)
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)

const plannedJourneyIds = sessions.flatMap((session) => session.journeys.map((journey) => journey.id))
const plannedRows = rows.filter((row) => plannedJourneyIds.includes(row.journeyId))
const passedJourneyIds = new Set(plannedRows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
const openHighPriorityRows = plannedRows.filter((row) => (row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass')
const requestedSession = options.day ? sessions.find((session) => session.aliases.includes(normalize(options.day))) : undefined
const firstIncompleteSession = sessions.find((session) => session.journeys.some((journey) => !passedJourneyIds.has(journey.id))) ?? sessions[0]
const session = requestedSession ?? firstIncompleteSession
const devices = getRequiredDevices(session)

console.log('TenAceIQ Today QA Sheet')
console.log('')
console.log('Use this as the compact testing-day command: one session, required devices, proof targets, and closeout gates.')
console.log('')
console.log(`${session.label}: ${session.focus}`)
console.log(`Question: ${session.question}`)
console.log(`Date: ${date}`)
console.log(`Tester: ${tester}`)
console.log(`Source: ${resultsPath}`)
console.log(`Pass coverage: ${passedJourneyIds.size}/${plannedJourneyIds.length}`)
console.log('')

if (openHighPriorityRows.length) {
  console.log('Stop first: open p0/p1 rows need a fix or explicit launch decision before wider testing.')
  for (const row of openHighPriorityRows) {
    console.log(`- ${row.severity} ${row.result}: ${row.journeyId}`)
    console.log(`  Category: ${row.category || 'uncategorized'}`)
    console.log(`  Next action: ${row.nextAction || 'missing next action'}`)
  }
  console.log('')
  console.log('Run:')
  console.log('- npm run qa:triage')
  console.log('- npm run qa:action-list')
  console.log('- npm run qa:retest -- <day-or-journey>')
  process.exit(0)
}

console.log('Fixtures to confirm:')
for (const fixture of session.fixtures) console.log(`- ${fixture}`)
console.log('')

console.log('Required device packets:')
for (const deviceId of devices) {
  const device = deviceProfiles[deviceId]
  console.log(`- ${device.label}: npm run qa:tester-packet -- ${session.id} --device=${deviceId} --date=${date} --tester=${slug(tester)}`)
  console.log(`  Why: ${device.why}`)
}
console.log('')

console.log('Journeys to prove:')
for (const journey of session.journeys) {
  const state = passedJourneyIds.has(journey.id) ? 'has pass row' : 'needs pass evidence'
  console.log(`- ${journey.id}: ${state}`)
  console.log(`  Route: ${journey.route}`)
  console.log(`  Fixture: ${journey.fixture}`)
  console.log(`  Devices: ${journey.devices.join(', ')}`)
  console.log(`  Proof: ${journey.proof}`)
}
console.log('')

console.log('Run order:')
console.log(`1. npm run qa:day -- ${session.id} --date=${date} --tester=${slug(tester)}`)
console.log(`2. npm run qa:evidence-pack -- ${session.id} --date=${date} --tester=${slug(tester)} --device=<phone|ipad|desktop>`)
console.log('3. Run each required device packet above.')
console.log('4. Capture evidence names from the packet and paste/update ledger rows.')
console.log('5. Keep rows as needs-follow-up until the exact device proof is real.')
console.log('')

console.log('Close this block:')
console.log('- npm run qa:ledger-check')
console.log(`- npm run qa:session-status -- ${session.id}`)
console.log(`- npm run qa:close-day -- ${session.id} --date=${date}`)
console.log(`- npm run qa:daily-summary -- ${date}`)
console.log('- npm run qa:next')
console.log('')
console.log('Closeout rule: today is done only when the session has pass evidence on required devices and every open row has a next action.')

function getRequiredDevices(session) {
  const required = new Set(session.journeys.flatMap((journey) => journey.devices))
  return ['phone', 'tablet', 'desktop'].filter((deviceId) => required.has(deviceId))
}

function parseArgs(args) {
  const parsed = {
    day: '',
    date: '',
    tester: '',
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? ''

    if (!arg.startsWith('--')) {
      if (!parsed.day) parsed.day = arg
      continue
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=')
    const key = rawKey.trim().toLowerCase()
    const nextValue = args[index + 1] ?? ''
    const value = inlineValue ?? (nextValue.startsWith('--') ? '' : nextValue)

    if (inlineValue === undefined && value) index += 1

    if (key === 'date') parsed.date = value
    if (key === 'tester') parsed.tester = value
  }

  return parsed
}

function parseMarkdownRow(line) {
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())

  return {
    journeyId: cells[4] ?? '',
    result: cells[6] ?? '',
    category: cells[7] ?? '',
    severity: cells[8] ?? '',
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

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tester'
}
