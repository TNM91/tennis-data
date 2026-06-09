import { customerJourneyDetails, customerJourneyDeviceProfiles, normalizeQaQuery, sessionByJourneyId } from './customer-journey-qa-data.mjs'

const options = parseArgs(process.argv.slice(2))
const rawQuery = options.query.trim().toLowerCase()
const normalizedQuery = normalizeQaQuery(rawQuery)

const deviceProfiles = customerJourneyDeviceProfiles

const tierLabels = {
  free: 'Free',
  player_plus: 'Player+',
  coach: 'Coach',
  captain: 'Captain',
  league: 'TIQ League Coordinator/Admin',
  full_court: 'Full-Court',
  admin_internal: 'Admin/Internal',
}

const journeys = customerJourneyDetails

const queryDevice = deviceProfiles.find((profile) => normalizeQaQuery(profile.id) === normalizedQuery || profile.aliases.map(normalizeQaQuery).includes(normalizedQuery))
const matchingJourneys = journeys.filter(matchesQuery)
const visibleJourneys = queryDevice ? journeys.filter((journey) => journey.requiredDeviceIds.includes(queryDevice.id)) : matchingJourneys
const ledgerRows = visibleJourneys.flatMap((journey) => buildRowsForJourney(journey, queryDevice?.id))

console.log('TenAceIQ Device Ledger Rows')
console.log('')
console.log('Paste these rows into docs/customer-journey-test-results.md when you are logging required phone, tablet, or desktop evidence.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!ledgerRows.length) {
  console.log(`No device ledger rows matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:device-ledger -- <phone | tablet | desktop | journey-id | tier | search> --date=yyyy-mm-dd --tester=<name>')
  process.exit(1)
}

if (options.date || options.tester) {
  console.log(`Defaults: date=${options.date || 'blank'}, tester=${options.tester || 'blank'}`)
  console.log('')
}

console.log('| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')

for (const row of ledgerRows) {
  console.log(
    `| ${formatCell(options.date)} | ${formatCell(options.tester)} | ${row.deviceValue} | ${row.fixture} | ${row.journeyId} | ${row.route} | needs-follow-up |  |  | ${row.evidenceCell} |  |  |`,
  )
}

console.log('')
console.log('Rows by journey/device:')
for (const row of ledgerRows) {
  console.log(`- ${row.label} (${row.journeyId}) on ${row.deviceLabel}: ${row.evidenceCell}`)
}

console.log('')
console.log('Use with:')
console.log('- npm run qa:device-card -- <phone | tablet | desktop | journey-id>')
console.log('- npm run qa:device-status -- <phone | tablet | desktop | journey-id>')
console.log('- npm run qa:ledger-check')
console.log('')
console.log('Closeout rule: change `needs-follow-up` to `pass` only after the screenshots/videos prove the viewport-specific risk.')

function buildRowsForJourney(journey, activeDeviceId) {
  const requiredDevices = activeDeviceId ? journey.requiredDeviceIds.filter((deviceId) => deviceId === activeDeviceId) : journey.requiredDeviceIds

  return requiredDevices.map((deviceId) => {
    const device = deviceProfiles.find((profile) => profile.id === deviceId)
    const deviceValue = device?.deviceValue ?? deviceId
    const sessionId = sessionByJourneyId.get(journey.id)?.id ?? 'unassigned'
    const evidenceCell = journey.evidenceSlugs
      .map((evidenceName) => `${options.date || 'yyyy-mm-dd'}-${sessionId}-${journey.id}-${evidenceName}-${deviceValue}-${slug(options.tester || 'tester')}.png`)
      .join('; ')

    return {
      journeyId: journey.id,
      label: journey.label,
      tierId: journey.tierId,
      route: journey.entryRoute,
      fixture: journey.accountFixture,
      deviceValue,
      deviceLabel: device?.label ?? deviceId,
      evidenceCell,
    }
  })
}

function matchesQuery(journey) {
  if (!rawQuery) return true
  if (queryDevice) return journey.requiredDeviceIds.includes(queryDevice.id)

  const tierId = Object.entries(tierLabels).find(([id, label]) => normalizeQaQuery(id.replace(/_/g, '')) === normalizedQuery || normalizeQaQuery(label) === normalizedQuery)?.[0]
  if (tierId) return journey.tierId === tierId

  return searchableText(journey).includes(rawQuery) || searchableText(journey).includes(normalizedQuery)
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
    ...journey.requiredDeviceIds,
  ]
    .join(' ')
    .toLowerCase()
}

function parseArgs(args) {
  const parsed = {
    query: '',
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
  }

  return parsed
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function slug(value) {
  return normalize(value || 'tester')
}

function formatCell(value) {
  return value.trim().replace(/\|/g, '/')
}
