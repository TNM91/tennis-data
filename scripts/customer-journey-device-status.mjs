import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)

const deviceProfiles = [
  {
    id: 'phone',
    aliases: ['phone', 'mobile', 'iphone', 'ios', 'android'],
    label: 'Phone',
  },
  {
    id: 'tablet',
    aliases: ['tablet', 'ipad'],
    label: 'Tablet / iPad',
  },
  {
    id: 'desktop',
    aliases: ['desktop', 'laptop', 'pc', 'mac', 'windows'],
    label: 'Desktop',
  },
]

const tierLabels = {
  free: 'Free',
  player_plus: 'Player+',
  coach: 'Coach',
  captain: 'Captain',
  league: 'TIQ League Coordinator/Admin',
  full_court: 'Full-Court',
  admin_internal: 'Admin/Internal',
}

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    tierId: 'player_plus',
    session: 'day1',
    route: '/player-development/relentless-competitor-4-0/level-up',
    fixture: 'player_plus_linked',
    requiredDevices: ['phone', 'tablet'],
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    tierId: 'coach',
    session: 'day1',
    route: '/coach',
    fixture: 'coach_primary',
    requiredDevices: ['phone', 'tablet', 'desktop'],
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    tierId: 'coach',
    session: 'day2',
    route: '/player-development/relentless-competitor-4-0/coach-planner',
    fixture: 'coach_primary',
    requiredDevices: ['tablet', 'desktop'],
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    tierId: 'player_plus',
    session: 'day2',
    route: '/mylab',
    fixture: 'player_plus_linked',
    requiredDevices: ['phone', 'desktop'],
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    tierId: 'captain',
    session: 'day3',
    route: '/captain',
    fixture: 'captain_primary',
    requiredDevices: ['phone', 'tablet', 'desktop'],
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    tierId: 'league',
    session: 'day4',
    route: '/league-coordinator',
    fixture: 'league_coordinator',
    requiredDevices: ['tablet', 'desktop'],
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    tierId: 'full_court',
    session: 'day5',
    route: '/pricing',
    fixture: 'full_court_operator',
    requiredDevices: ['phone', 'desktop'],
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    tierId: 'admin_internal',
    session: 'day4',
    route: '/admin/access',
    fixture: 'admin_test',
    requiredDevices: ['desktop'],
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    tierId: 'free',
    session: 'day5',
    route: '/explore',
    fixture: 'free_viewer',
    requiredDevices: ['phone', 'desktop'],
  },
]

const rows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => journeys.some((journey) => journey.id === row.journeyId))
  .filter((row) => !isHeaderRow(row))
  .filter((row) => !isBlankTemplateRow(row))

const queryDevice = deviceProfiles.find((profile) => profile.id === normalizedQuery || profile.aliases.map(normalize).includes(normalizedQuery))
const matchingJourneys = journeys.filter(matchesQuery)
const visibleJourneys = queryDevice ? journeys.filter((journey) => journey.requiredDevices.includes(queryDevice.id)) : matchingJourneys
const statusRows = visibleJourneys.map((journey) => buildDeviceStatus(journey, queryDevice?.id))
const totalRequired = statusRows.reduce((sum, row) => sum + row.requiredDevices.length, 0)
const totalPassed = statusRows.reduce((sum, row) => sum + row.passedDevices.length, 0)

console.log('TenAceIQ Device Status')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log('Use this after logging results to see device coverage by journey before calling a viewport-sensitive pass ready.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!visibleJourneys.length) {
  console.log(`No device status matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:device-status -- <phone | tablet | desktop | journey-id | tier | search>')
  process.exit(1)
}

console.log(`Device coverage: ${totalPassed}/${totalRequired} required device passes`)
console.log(`Ledger rows checked: ${rows.length}`)
console.log('')
console.log('| Tier | Session | Journey | Required | Passed | Missing | Next |')
console.log('| --- | --- | --- | --- | --- | --- | --- |')

for (const row of statusRows) {
  console.log(
    `| ${tierLabels[row.journey.tierId]} | ${row.journey.session} | ${row.journey.label} | ${formatDevices(row.requiredDevices)} | ${formatDevices(row.passedDevices)} | ${formatDevices(row.missingDevices)} | ${row.nextCommand} |`,
  )
}

console.log('')
console.log('Use with:')
console.log('- npm run qa:device-card -- <phone | tablet | desktop | journey-id>')
console.log('- npm run qa:live-card -- <journey-id> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>')
console.log('- npm run qa:ledger-check')
console.log('- npm run qa:scorecard')
console.log('')
console.log('Closeout rule: device coverage needs pass rows with screenshot/video evidence and a device/browser value that maps to the required viewport.')

function buildDeviceStatus(journey, activeDeviceId) {
  const journeyRows = rows.filter((row) => row.journeyId === journey.id)
  const requiredDevices = activeDeviceId ? journey.requiredDevices.filter((deviceId) => deviceId === activeDeviceId) : journey.requiredDevices
  const passedDevices = requiredDevices.filter((deviceId) =>
    journeyRows.some((row) => row.result === 'pass' && row.screenshotOrVideo && getDeviceId(row.deviceBrowser) === deviceId),
  )
  const missingDevices = requiredDevices.filter((deviceId) => !passedDevices.includes(deviceId))
  const nextDevice = missingDevices[0]

  return {
    journey,
    requiredDevices,
    passedDevices,
    missingDevices,
    nextCommand: nextDevice
      ? `npm run qa:live-card -- ${journey.id} --date=yyyy-mm-dd --tester=<name> --device=${deviceProfiles.find((profile) => profile.id === nextDevice)?.id ?? nextDevice}`
      : `npm run qa:scorecard`,
  }
}

function matchesQuery(journey) {
  if (!rawQuery) return true
  if (queryDevice) return journey.requiredDevices.includes(queryDevice.id)

  const tierId = Object.entries(tierLabels).find(([id, label]) => normalize(id) === normalizedQuery || normalize(label) === normalizedQuery)?.[0]
  if (tierId) return journey.tierId === tierId

  return searchableText(journey).includes(rawQuery) || searchableText(journey).includes(normalizedQuery)
}

function searchableText(journey) {
  return [
    journey.id,
    journey.label,
    journey.tierId,
    tierLabels[journey.tierId],
    journey.session,
    journey.route,
    journey.fixture,
    ...journey.requiredDevices,
  ]
    .join(' ')
    .toLowerCase()
}

function getDeviceId(value) {
  const normalizedValue = normalize(value)
  return deviceProfiles.find((profile) => profile.id === normalizedValue || profile.aliases.map(normalize).some((alias) => normalizedValue.includes(alias)))?.id
}

function formatDevices(deviceIds) {
  if (!deviceIds.length) return 'none'
  return deviceIds.map((deviceId) => deviceProfiles.find((profile) => profile.id === deviceId)?.label ?? deviceId).join(', ')
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

function isHeaderRow(row) {
  return row.date === 'Date' && row.journeyId === 'Journey ID'
}

function isBlankTemplateRow(row) {
  return !row.date && !row.tester && !row.deviceBrowser && !row.accountFixture && !row.journeyId && row.result.includes('pass / fail')
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
