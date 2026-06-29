import { customerJourneySessions, fixtureGateJourneyIds, getFixtureAuthSmokeCommand, journeyById, normalizeQaQuery } from './customer-journey-qa-data.mjs'

const options = parseArgs(process.argv.slice(2))
const rawSession = options.session.trim().toLowerCase()
const normalizedSession = normalizeQaQuery(rawSession)
const normalizedDevice = normalize(options.device)

const deviceProfiles = [
  {
    id: 'phone',
    aliases: ['phone', 'mobile', 'iphone', 'ios', 'android'],
    label: 'Phone',
    value: 'phone',
    viewport: '390 x 844',
  },
  {
    id: 'tablet',
    aliases: ['tablet', 'ipad'],
    label: 'Tablet / iPad',
    value: 'ipad',
    viewport: '820 x 1180',
  },
  {
    id: 'desktop',
    aliases: ['desktop', 'laptop', 'pc', 'mac', 'windows'],
    label: 'Desktop',
    value: 'desktop',
    viewport: '1440 x 1000',
  },
]

const session = customerJourneySessions.find((item) => item.aliases.includes(normalizedSession))
const device = deviceProfiles.find((profile) => profile.id === normalizedDevice || profile.aliases.map(normalize).includes(normalizedDevice))
const tester = options.tester || '<name>'
const date = options.date || 'yyyy-mm-dd'

console.log('TenAceIQ Tester Packet')
console.log('')
console.log('Use this at the start of a real testing block so the route, device, evidence names, ledger rows, and closeout commands stay together.')
console.log('')

if (!session || !device) {
  console.log('Usage: npm run qa:tester-packet -- <day1 | day2 | day3 | day4 | day5> --device=<phone|tablet|desktop> --date=yyyy-mm-dd --tester=<name>')
  console.log('')
  console.log('Examples:')
  console.log('- npm run qa:tester-packet -- day1 --device=phone --date=2026-06-05 --tester=nick')
  console.log('- npm run qa:tester-packet -- day4 --device=desktop --date=2026-06-05 --tester=nick')
  console.log('')
  console.log('Available sessions:')
  for (const item of customerJourneySessions) console.log(`- ${item.id}: ${item.shortLabel} - ${item.focus}`)
  console.log('')
  console.log('Available devices:')
  for (const item of deviceProfiles) console.log(`- ${item.id}: ${item.label} (${item.viewport})`)
  process.exit(rawSession || options.device ? 1 : 0)
}

const sessionJourneys = session.journeyIds.map((journeyId) => journeyById.get(journeyId)).filter(Boolean)
const deviceJourneys = sessionJourneys.filter((journey) => journey.requiredDeviceIds.includes(device.id))
const skippedJourneys = sessionJourneys.filter((journey) => !journey.requiredDeviceIds.includes(device.id))

console.log(`${session.shortLabel}: ${session.focus}`)
console.log(`Question: ${session.closeoutQuestion}`)
console.log(`Tester: ${tester}`)
console.log(`Date: ${date}`)
console.log(`Device: ${device.label} (${device.viewport})`)
console.log('')

if (!deviceJourneys.length) {
  console.log(`No ${device.label} journeys are required for ${session.id}.`)
  console.log('Choose another device or run `npm run qa:session -- <day>` for the full session context.')
  process.exit(1)
}

console.log('Run Order:')
console.log(`1. npm run qa:session -- ${session.id}`)
console.log(`2. npm run qa:device-card -- ${device.id}`)
console.log(`3. npm run qa:evidence-pack -- ${session.id} --date=${date} --tester=${slug(tester)} --device=${device.value}`)
console.log(`4. npm run qa:device-ledger -- ${device.id} --date=${date} --tester=${slug(tester)}`)
console.log('5. Walk only the journeys listed below, then paste or update the generated result rows.')
console.log('6. npm run qa:ledger-check')
console.log(`7. npm run qa:device-status -- ${device.id}`)
console.log(`8. npm run qa:session-status -- ${session.id}`)
console.log(`9. npm run qa:daily-summary -- ${date}`)
console.log('')

console.log('Journeys To Walk On This Device:')
for (const journey of deviceJourneys) {
  console.log(`- ${journey.label} (${journey.id})`)
  console.log(`  Route: ${journey.entryRoute}`)
  console.log(`  Fixture: ${journey.accountFixture}`)
  console.log(`  Pass: ${journey.passSignal}`)
  console.log(`  Capture: ${journey.evidence.join('; ')}`)
  const authSmokeCommand = getFixtureAuthSmokeCommand(journey.accountFixture)
  if (fixtureGateJourneyIds.has(journey.id) || authSmokeCommand) {
    console.log(`  Fixture gate: npm run qa:fixture-gate -- ${journey.id}`)
    console.log('  Auth env: npm run qa:fixture-auth-smoke -- --env')
    console.log(`  Auth smoke: ${authSmokeCommand || 'npm run qa:fixture-auth-smoke'}`)
  }
  console.log(`  Live card: npm run qa:live-card -- ${journey.id} --date=${date} --tester=${slug(tester)} --device=${device.value}`)
}

if (skippedJourneys.length) {
  console.log('')
  console.log('Not Required For This Device:')
  for (const journey of skippedJourneys) {
    console.log(`- ${journey.label} (${journey.id}) requires ${journey.requiredDeviceIds.join(', ')}`)
  }
}

console.log('')
console.log('Result Rule:')
console.log('- Keep generated rows as `needs-follow-up` until evidence proves the pass signal on this exact device.')
console.log('- Use `mobile-ux-gap` for scroll, overlap, tap target, or hidden-action issues.')
console.log('- Use `content-quality-gap` if the page loads but does not help the tester act.')
console.log('')
console.log('Closeout rule: a testing block is useful only when the ledger, screenshot names, and next action agree.')

function parseArgs(args) {
  const parsed = {
    session: '',
    device: '',
    date: '',
    tester: '',
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
    if (key === 'device' || key === 'browser' || key === 'device-browser') parsed.device = value
  }

  return parsed
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function slug(value) {
  return normalize(value || 'tester')
}
