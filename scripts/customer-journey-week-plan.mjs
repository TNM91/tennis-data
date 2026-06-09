import { customerJourneyDetails, customerJourneyDeviceProfiles, customerJourneySessions } from './customer-journey-qa-data.mjs'

const options = parseArgs(process.argv.slice(2))
const tester = options.tester || '<name>'
const date = options.date || 'yyyy-mm-dd'

const deviceProfiles = Object.fromEntries(
  customerJourneyDeviceProfiles.map((device) => [
    device.id,
    {
      label: device.label,
      value: device.deviceValue,
      reason: device.priority,
    },
  ]),
)

const journeyById = new Map(customerJourneyDetails.map((journey) => [journey.id, journey]))
const weeklyPlan = customerJourneySessions.map((session) => ({
  id: session.id,
  label: session.shortLabel,
  focus: session.focus,
  question: session.closeoutQuestion,
  journeys: session.journeyIds.map((journeyId) => {
    const journey = journeyById.get(journeyId)
    if (!journey) throw new Error(`Missing shared QA journey metadata for ${journeyId}`)

    return {
      id: journey.id,
      route: journey.entryRoute,
      fixture: journey.accountFixture,
      devices: journey.requiredDeviceIds,
      risk: journey.deviceRisk,
    }
  }),
}))

const filteredPlan = options.day ? weeklyPlan.filter((day) => day.id === normalizeDay(options.day)) : weeklyPlan

console.log('TenAceIQ Test Week Plan')
console.log('')
console.log('Use this to schedule the full manual QA sweep by day and device. Each device packet keeps routes, evidence, ledger rows, and closeout commands together.')
console.log('')

if (!filteredPlan.length) {
  console.log('Usage: npm run qa:week-plan -- --date=yyyy-mm-dd --tester=<name>')
  console.log('       npm run qa:week-plan -- day1 --date=yyyy-mm-dd --tester=<name>')
  console.log('')
  console.log('Available days: day1, day2, day3, day4, day5')
  process.exit(1)
}

console.log(`Defaults: date=${date}, tester=${tester}`)
console.log('')
console.log('Before The Week:')
console.log('- npm run qa:prep')
console.log('- npm run qa:fixtures')
console.log('- npm run qa:status')
console.log('- Confirm safe test accounts and fixture data before recording product results.')

for (const day of filteredPlan) {
  const devices = getRequiredDevices(day)

  console.log('')
  console.log(`${day.label}: ${day.focus}`)
  console.log(`Question: ${day.question}`)
  console.log(`Required devices: ${devices.map((deviceId) => deviceProfiles[deviceId]?.label ?? deviceId).join(', ')}`)
  console.log('')
  console.log('Run these packets:')
  for (const deviceId of devices) {
    const device = deviceProfiles[deviceId]
    console.log(`- npm run qa:tester-packet -- ${day.id} --device=${deviceId} --date=${date} --tester=${slug(tester)}`)
    console.log(`  Why: ${device?.reason ?? 'Proves required device coverage.'}`)
  }

  console.log('')
  console.log('Journeys and device risks:')
  for (const journey of day.journeys) {
    console.log(`- ${journey.id}`)
    console.log(`  Route: ${journey.route}`)
    console.log(`  Fixture: ${journey.fixture}`)
    console.log(`  Devices: ${journey.devices.join(', ')}`)
    console.log(`  Risk: ${journey.risk}`)
  }

  console.log('')
  console.log('Close this day with:')
  console.log('- npm run qa:ledger-check')
  console.log(`- npm run qa:session-status -- ${day.id}`)
  console.log(`- npm run qa:close-day -- ${day.id} --date=${date}`)
  console.log(`- npm run qa:daily-summary -- ${date}`)
}

console.log('')
console.log('End Of Week Gates:')
console.log('- npm run qa:scorecard')
console.log('- npm run qa:signoff')
console.log('- npm run qa:launch')
console.log('- npm run verify:closeout')
console.log('- npm run verify:closeout:live after deploy')
console.log('')
console.log('Closeout rule: do not call the week test-ready until every required device pass has real evidence and every p0/p1 has a fix or launch decision.')

function getRequiredDevices(day) {
  const devices = [...new Set(day.journeys.flatMap((journey) => journey.devices))]
  return ['phone', 'tablet', 'desktop'].filter((deviceId) => devices.includes(deviceId))
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

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tester'
}
