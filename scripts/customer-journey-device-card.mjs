import { customerJourneyDetails, customerJourneyDeviceProfiles, sessionByJourneyId } from './customer-journey-qa-data.mjs'

const options = parseArgs(process.argv.slice(2))
const rawQuery = options.query.trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)

const tierLabels = {
  free: 'Free',
  player_plus: 'Player+',
  coach: 'Coach',
  captain: 'Captain',
  league: 'TIQ League Coordinator/Admin',
  full_court: 'Full-Court',
  admin_internal: 'Admin/Internal',
}

const deviceProfiles = customerJourneyDeviceProfiles
const journeys = customerJourneyDetails

console.log('TenAceIQ Device Journey Card')
console.log('')
console.log('Use this before manual testing to pick the right viewport, checks, evidence names, and live-card command.')
console.log('')

const device = getDevice()
const matches = getJourneyMatches()

if (!device && !matches.length) {
  printUsage()
  process.exit(rawQuery ? 1 : 0)
}

if (device) printDevice(device)

const visibleJourneys = matches.length ? matches : journeys.filter((journey) => device && journey.requiredDeviceIds.includes(device.id))

if (!visibleJourneys.length) {
  console.log(`No journey matched "${rawQuery}".`)
  console.log('')
  printUsage()
  process.exit(1)
}

console.log('Journey device pass:')
for (const journey of visibleJourneys) printJourney(journey, device)

console.log('')
console.log('Use with:')
console.log('- npm run qa:live-card -- <journey-id> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>')
console.log('- npm run qa:route-review -- <route>')
console.log('- npm run qa:ledger-check')
console.log('')
console.log('Closeout rule: a device pass is only real when the ledger row names the device/browser and the evidence proves the viewport-specific risk was checked.')

function printDevice(profile) {
  console.log(`${profile.label} device profile`)
  console.log(`Viewport: ${profile.viewport}`)
  console.log(`When to use: ${profile.priority}`)
  console.log('')
  console.log('Viewport checks:')
  for (const check of profile.checks) console.log(`- ${check}`)
  console.log('')
}

function printJourney(journey, profile) {
  const deviceId = profile?.id ?? journey.requiredDeviceIds[0]
  const deviceLabel = profile?.label ?? deviceProfiles.find((item) => item.id === deviceId)?.label ?? deviceId
  const deviceName = profile?.deviceValue ?? deviceId

  console.log(`- ${journey.label} (${journey.id})`)
  console.log(`  Tier: ${tierLabels[journey.tierId]} | Session: ${sessionByJourneyId.get(journey.id)?.id ?? 'unassigned'} | Device: ${deviceLabel}`)
  console.log(`  Route: ${journey.entryRoute}`)
  console.log(`  Fixture: ${journey.accountFixture}`)
  console.log(`  Device risk: ${journey.deviceRisk}`)
  console.log(`  Command: npm run qa:live-card -- ${journey.id} --date=yyyy-mm-dd --tester=<name> --device=${deviceName}`)
}

function getDevice() {
  const optionDevice = normalize(options.device)
  if (optionDevice) return deviceProfiles.find((profile) => profile.id === optionDevice || profile.aliases.map(normalize).includes(optionDevice))

  return deviceProfiles.find((profile) => profile.id === normalizedQuery || profile.aliases.map(normalize).includes(normalizedQuery))
}

function getJourneyMatches() {
  if (!rawQuery) return []

  const exact = journeys.find((journey) => journey.id === normalizedQuery || normalize(journey.label) === normalizedQuery)
  if (exact) return [exact]

  const tierId = Object.entries(tierLabels).find(([id, label]) => normalize(id) === normalizedQuery || normalize(label) === normalizedQuery)?.[0]
  if (tierId) return journeys.filter((journey) => journey.tierId === tierId)

  if (getDevice()) return []

  return journeys.filter((journey) => searchableText(journey).includes(rawQuery) || searchableText(journey).includes(normalizedQuery))
}

function searchableText(journey) {
  return [
    journey.id,
    journey.label,
    journey.tierId,
    tierLabels[journey.tierId],
    sessionByJourneyId.get(journey.id)?.id ?? '',
    journey.entryRoute,
    journey.accountFixture,
    journey.deviceRisk,
    ...journey.requiredDeviceIds,
  ]
    .join(' ')
    .toLowerCase()
}

function printUsage() {
  console.log('Usage: npm run qa:device-card -- <phone | tablet | desktop | journey-id | tier | search> --device=<phone|tablet|desktop>')
  console.log('')
  console.log('Device profiles:')
  for (const profile of deviceProfiles) {
    console.log(`- ${profile.id}: ${profile.label} (${profile.viewport})`)
  }
  console.log('')
  console.log('Available journey device cards:')
  for (const journey of journeys) {
    console.log(`- ${journey.id} (${journey.requiredDeviceIds.join(', ')})`)
  }
}

function parseArgs(args) {
  const parsed = {
    query: '',
    device: '',
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
    if (key === 'device') parsed.device = value
  }

  return parsed
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
