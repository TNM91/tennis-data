import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneySessions, normalizeQaQuery, plannedJourneyIds } from './customer-journey-qa-data.mjs'

const options = parseArgs(process.argv.slice(2))
const date = options.date || 'yyyy-mm-dd'
const tester = options.tester || '<name>'
const device = normalizeDevice(options.device || 'phone')
const resultsPath = 'docs/customer-journey-test-results.md'

const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const rows = extractResultLedger(source)
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))

const passedJourneyIds = new Set(rows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
const openHighPriorityRows = rows.filter((row) => (row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass')
const firstIncompleteSession = customerJourneySessions.find((session) => session.journeyIds.some((journeyId) => !passedJourneyIds.has(journeyId))) ?? customerJourneySessions[0]
const session = options.day ? customerJourneySessions.find((item) => item.aliases.includes(normalizeQaQuery(options.day))) ?? firstIncompleteSession : firstIncompleteSession
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
for (const journeyId of session.journeyIds) {
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
