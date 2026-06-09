import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, customerJourneySessions, fixtureGateJourneyIds, normalizeQaQuery, sessionByJourneyId } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'
const options = parseArgs(process.argv.slice(2))
const rawQuery = options.query.trim().toLowerCase()
const normalizedQuery = normalizeQaQuery(rawQuery)
const normalizedDevice = normalize(options.device || 'phone')
const date = options.date || 'yyyy-mm-dd'
const tester = options.tester || '<name>'

const tierLabels = {
  free: 'Free',
  player_plus: 'Player+',
  coach: 'Coach',
  captain: 'Captain',
  league: 'TIQ League Coordinator/Admin',
  full_court: 'Full-Court',
  admin_internal: 'Admin/Internal',
}

const devices = [
  { id: 'phone', aliases: ['phone', 'mobile', 'iphone', 'ios', 'android'], label: 'Phone', value: 'phone', viewport: '390 x 844' },
  { id: 'tablet', aliases: ['tablet', 'ipad'], label: 'Tablet / iPad', value: 'ipad', viewport: '820 x 1180' },
  { id: 'desktop', aliases: ['desktop', 'laptop', 'pc', 'mac', 'windows'], label: 'Desktop', value: 'desktop', viewport: '1440 x 1000' },
]

const journeys = customerJourneyDetails

const rows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)

const selectedDevice = devices.find((device) => device.id === normalizedDevice || device.aliases.map(normalize).includes(normalizedDevice)) ?? devices[0]
const matches = getMatches()

console.log('TenAceIQ Journey Kickoff')
console.log('')
console.log('Use this when you are about to test one journey and need the route, fixtures, device, evidence, ledger row, and closeout gates in one place.')
console.log(`Source: ${resultsPath}`)
console.log('')

if (!matches.length) {
  if (rawQuery) {
    console.log(`No journey matched "${rawQuery}".`)
    console.log('')
  }
  printUsage()
  process.exit(rawQuery ? 1 : 0)
}

for (const journey of matches) printKickoff(journey)

console.log('Kickoff rule: do not start browser proof from memory. Confirm fixtures, capture named evidence, paste one honest ledger row, then run the closeout gates.')

function getMatches() {
  if (!rawQuery) return [getNextJourney()]

  const session = customerJourneySessions.find((item) => item.aliases.includes(normalizedQuery))
  if (session) return session.journeyIds.map((journeyId) => journeys.find((journey) => journey.id === journeyId)).filter(Boolean)

  const tierId = Object.entries(tierLabels).find(([id, label]) => {
    const normalizedId = normalizeQaQuery(id.replace(/_/g, ''))
    const normalizedLabel = normalizeQaQuery(label)

    return normalizedId === normalizedQuery || normalizedLabel === normalizedQuery
  })?.[0]

  if (tierId) return journeys.filter((journey) => journey.tierId === tierId)

  const exact = journeys.find((journey) => normalizeQaQuery(journey.id) === normalizedQuery || normalizeQaQuery(journey.label) === normalizedQuery)
  if (exact) return [exact]

  return journeys.filter((journey) =>
    [
      journey.id,
      journey.label,
      journey.tierId,
      journey.accountFixture,
      journey.entryRoute,
      ...journey.fixtureIds,
      ...journey.featureIds,
      ...journey.evidence,
    ]
      .join(' ')
      .toLowerCase()
      .includes(rawQuery),
  )
}

function getNextJourney() {
  return journeys.find((journey) => {
    const journeyRows = rows.filter((row) => row.journeyId === journey.id)
    return !journeyRows.some((row) => row.result === 'pass' && row.screenshotOrVideo)
  }) ?? journeys[0]
}

function printKickoff(journey) {
  const session = sessionByJourneyId.get(journey.id)
  const latestRow = rows.filter((row) => row.journeyId === journey.id).at(-1)
  const fixtureQuery = journey.fixtureIds[0] ?? journey.accountFixture
  const device = journey.requiredDeviceIds.includes(selectedDevice.id) ? selectedDevice : devices.find((item) => journey.requiredDeviceIds.includes(item.id)) ?? selectedDevice
  const resultState = latestRow
    ? `${latestRow.result || 'logged'}${latestRow.category ? `/${latestRow.category}` : ''}${latestRow.screenshotOrVideo ? ' with evidence' : ' without evidence'}`
    : 'missing result row'

  console.log(`${journey.label} (${journey.id})`)
  console.log(`Tier: ${tierLabels[journey.tierId]} | Session: ${session?.id ?? 'unassigned'} | Risk: ${journey.risk}`)
  console.log(`Device: ${device.label} (${device.viewport}) | Required devices: ${journey.requiredDeviceIds.join(', ')}`)
  console.log(`Route: ${journey.entryRoute}`)
  console.log(`Fixture: ${journey.accountFixture}`)
  console.log(`Ledger state: ${resultState}`)
  console.log('')
  console.log(`Question: ${journey.primaryQuestion}`)
  console.log(`Pass signal: ${journey.passSignal}`)
  console.log('')
  console.log('Run order:')
  console.log(`1. npm run qa:fixture-board -- ${fixtureQuery}`)
  console.log(`2. npm run qa:fixture-status -- ${session?.id ?? journey.id}`)
  let step = 3
  if (fixtureGateJourneyIds.has(journey.id)) {
    console.log(`${step}. npm run qa:fixture-gate -- ${journey.id}`)
    step += 1
    console.log(`${step}. npm run qa:fixture-auth-smoke -- --env`)
    step += 1
    console.log(`${step}. npm run qa:fixture-auth-smoke`)
    step += 1
  }
  console.log(`${step}. npm run qa:tester-packet -- ${session?.id ?? 'day1'} --device=${device.id} --date=${date} --tester=${slug(tester)}`)
  step += 1
  console.log(`${step}. npm run qa:evidence-pack -- ${session?.id ?? 'day1'} --date=${date} --tester=${slug(tester)} --device=${device.value}`)
  step += 1
  console.log(`${step}. npm run qa:live-card -- ${journey.id} --date=${date} --tester=${slug(tester)} --device=${device.value}`)
  step += 1
  console.log(`${step}. Open ${journey.entryRoute} with ${journey.accountFixture}.`)
  step += 1
  console.log(`${step}. Capture the proof below and paste/update the ledger row.`)
  step += 1
  console.log(`${step}. npm run qa:ledger-check`)
  step += 1
  console.log(`${step}. npm run qa:session-status -- ${session?.id ?? journey.id}`)
  console.log('')
  console.log('Journey evidence to capture:')
  for (const evidence of journey.evidence) console.log(`- ${evidence}`)
  console.log('')
  console.log('Paste-ready ledger row:')
  console.log('| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |')
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  console.log(
    `| ${date} | ${tester} | ${device.value} | ${journey.accountFixture} | ${journey.id} | ${journey.entryRoute} | needs-follow-up |  |  |  |  | npm run qa:live-card -- ${journey.id} --date=${date} --tester=${slug(tester)} --device=${device.value} |`,
  )
  console.log('')
  console.log('If blocked:')
  console.log('- fixture-gap: missing account, linked state, or safe data.')
  console.log('- mobile-ux-gap: too much scroll, weak tap targets, overlap, or hidden next action.')
  console.log('- content-quality-gap: page loads but does not help the tester act.')
  console.log('')
}

function printUsage() {
  console.log('Usage: npm run qa:kickoff -- <journey-id | day1-day5 | tier | search> --device=<phone|tablet|desktop> --date=yyyy-mm-dd --tester=<name>')
  console.log('')
  console.log('Examples:')
  console.log('- npm run qa:kickoff -- player-level-up-mobile-loop --device=phone --date=2026-06-05 --tester=nick')
  console.log('- npm run qa:kickoff -- day1 --device=tablet --date=2026-06-05 --tester=nick')
  console.log('- npm run qa:kickoff -- coach --device=desktop')
  console.log('')
  console.log('No query defaults to the first journey missing pass evidence.')
}

function parseArgs(args) {
  const parsed = {
    query: '',
    device: '',
    date: '',
    tester: '',
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? ''

    if (!arg.startsWith('--')) {
      parsed.query = [parsed.query, arg].filter(Boolean).join(' ')
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

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function slug(value) {
  return normalize(value || 'tester')
}
