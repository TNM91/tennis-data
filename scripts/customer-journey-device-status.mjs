import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, customerJourneyDeviceProfiles, normalizeQaQuery, sessionByJourneyId } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
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

const rows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => journeys.some((journey) => journey.id === row.journeyId))
  .filter((row) => !isHeaderRow(row))
  .filter((row) => !isBlankTemplateRow(row))

const queryDevice = deviceProfiles.find((profile) => normalizeQaQuery(profile.id) === normalizedQuery || profile.aliases.map(normalizeQaQuery).includes(normalizedQuery))
const matchingJourneys = journeys.filter(matchesQuery)
const visibleJourneys = queryDevice ? journeys.filter((journey) => journey.requiredDeviceIds.includes(queryDevice.id)) : matchingJourneys
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
    `| ${tierLabels[row.journey.tierId]} | ${sessionByJourneyId.get(row.journey.id)?.id ?? 'unassigned'} | ${row.journey.label} | ${formatDevices(row.requiredDevices)} | ${formatDevices(row.passedDevices)} | ${formatDevices(row.missingDevices)} | ${row.nextCommand} |`,
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
  const requiredDevices = activeDeviceId ? journey.requiredDeviceIds.filter((deviceId) => deviceId === activeDeviceId) : journey.requiredDeviceIds
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
