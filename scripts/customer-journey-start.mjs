import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const options = parseArgs(process.argv.slice(2))
const date = options.date || 'yyyy-mm-dd'
const tester = options.tester || '<name>'
const device = normalizeDevice(options.device || 'phone')
const resultsPath = 'docs/customer-journey-test-results.md'

const sessions = [
  {
    id: 'day1',
    label: 'Day 1 - Trust Loop',
    defaultDevice: 'phone',
    reason: 'Start with the trust loop: Level Up proof and coach assignment are the highest-risk connected flows.',
    journeys: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
  },
  {
    id: 'day2',
    label: 'Day 2 - Player And Coach Depth',
    defaultDevice: 'phone',
    reason: 'Run after Day 1 has real rows so return state and lesson support build on the trust loop.',
    journeys: ['coach-lesson-support', 'player-my-lab-return-state'],
  },
  {
    id: 'day3',
    label: 'Day 3 - Captain Week',
    defaultDevice: 'phone',
    reason: 'Captain testing should prove quick updates and full lineup decisions.',
    journeys: ['captain-week-flow'],
  },
  {
    id: 'day4',
    label: 'Day 4 - League And Admin',
    defaultDevice: 'desktop',
    reason: 'League/admin testing needs the most complete context and safe fixture review.',
    journeys: ['league-result-to-public-context', 'admin-access-and-data-quality'],
  },
  {
    id: 'day5',
    label: 'Day 5 - Full-Court And Free/Public Regression',
    defaultDevice: 'phone',
    reason: 'Regression should prove paid access and free discovery from a simple starting point.',
    journeys: ['full-court-access-pass', 'free-public-discovery'],
  },
]

const plannedJourneyIds = sessions.flatMap((session) => session.journeys)
const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const rows = extractResultLedger(source)
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))

const passedJourneyIds = new Set(rows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
const openHighPriorityRows = rows.filter((row) => (row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass')
const firstIncompleteSession = sessions.find((session) => session.journeys.some((journeyId) => !passedJourneyIds.has(journeyId))) ?? sessions[0]
const session = options.day ? sessions.find((item) => item.id === normalizeDay(options.day)) ?? firstIncompleteSession : firstIncompleteSession
const activeDevice = options.device ? device : session.defaultDevice

console.log('TenAceIQ QA Start')
console.log('')
console.log('Use this when you are about to begin manual journey testing and want the shortest useful path.')
console.log('')
console.log(`Recommended block: ${session.label}`)
console.log(`Why: ${session.reason}`)
console.log(`Date: ${date}`)
console.log(`Tester: ${tester}`)
console.log(`Device: ${activeDevice}`)
console.log('')

if (openHighPriorityRows.length) {
  console.log('Stop first: open p0/p1 rows need a fix or launch decision before wider testing.')
  for (const row of openHighPriorityRows) {
    console.log(`- ${row.severity} ${row.result}: ${row.journeyId}`)
    console.log(`  Next action: ${row.nextAction || 'missing next action'}`)
  }
  console.log('')
  console.log('Run:')
  console.log('- npm run qa:triage')
  console.log('- npm run qa:action-list')
  process.exit(0)
}

console.log('Run these first:')
console.log('1. npm run qa:readiness')
console.log(`2. npm run qa:tester-packet -- ${session.id} --device=${activeDevice} --date=${date} --tester=${slug(tester)}`)
console.log(`3. npm run qa:device-ledger -- ${activeDevice} --date=${date} --tester=${slug(tester)}`)
console.log('4. Walk the listed journeys and save screenshots/videos using the generated names.')
console.log('5. Paste/update the generated rows in docs/customer-journey-test-results.md.')
console.log('')

console.log('After logging rows:')
console.log('- npm run qa:ledger-check')
console.log(`- npm run qa:device-status -- ${activeDevice}`)
console.log(`- npm run qa:session-status -- ${session.id}`)
console.log(`- npm run qa:close-day -- ${session.id} --date=${date}`)
console.log('- npm run qa:next')
console.log('')

console.log('Journeys in this block:')
for (const journeyId of session.journeys) {
  const state = passedJourneyIds.has(journeyId) ? 'has pass row' : 'needs pass evidence'
  console.log(`- ${journeyId}: ${state}`)
}

console.log('')
console.log('Closeout rule: start small, log real evidence, then let qa:next choose the next block.')

function parseArgs(args) {
  const parsed = {
    day: '',
    date: '',
    tester: '',
    device: '',
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
    if (key === 'device' || key === 'browser' || key === 'device-browser') parsed.device = value
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

function normalizeDay(value) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const aliases = {
    '1': 'day1',
    '2': 'day2',
    '3': 'day3',
    '4': 'day4',
    '5': 'day5',
    day1: 'day1',
    day2: 'day2',
    day3: 'day3',
    day4: 'day4',
    day5: 'day5',
  }

  return aliases[normalized] ?? normalized
}

function normalizeDevice(value) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const aliases = {
    phone: 'phone',
    mobile: 'phone',
    iphone: 'phone',
    tablet: 'tablet',
    ipad: 'tablet',
    desktop: 'desktop',
    laptop: 'desktop',
  }

  return aliases[normalized] ?? normalized
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tester'
}
