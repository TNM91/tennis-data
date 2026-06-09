import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, customerJourneyDeviceProfiles, customerJourneySessions } from './customer-journey-qa-data.mjs'

const options = parseArgs(process.argv.slice(2))
const date = options.date || 'yyyy-mm-dd'
const tester = options.tester || '<name>'
const resultsPath = 'docs/customer-journey-test-results.md'

const deviceProfiles = Object.fromEntries(
  customerJourneyDeviceProfiles.map((device) => [
    device.id,
    {
      label: device.label,
      value: device.deviceValue,
      why: device.priority,
    },
  ]),
)

const journeyById = new Map(customerJourneyDetails.map((journey) => [journey.id, journey]))
const sessions = customerJourneySessions.map((session) => ({
  id: session.id,
  aliases: session.aliases,
  label: session.shortLabel,
  focus: session.focus,
  question: session.closeoutQuestion,
  fixtures: session.fixtureIds,
  journeys: session.journeyIds.map((journeyId) => {
    const journey = journeyById.get(journeyId)
    if (!journey) throw new Error(`Missing shared QA journey metadata for ${journeyId}`)

    return {
      id: journey.id,
      route: journey.entryRoute,
      fixture: journey.accountFixture,
      devices: journey.requiredDeviceIds,
      proof: journey.passSignal,
    }
  }),
}))

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
