const options = parseArgs(process.argv.slice(2))
const rawQuery = options.query.trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)

const deviceProfiles = [
  {
    id: 'phone',
    aliases: ['phone', 'mobile', 'iphone', 'ios', 'android'],
    label: 'Phone',
    deviceValue: 'phone',
  },
  {
    id: 'tablet',
    aliases: ['tablet', 'ipad'],
    label: 'Tablet / iPad',
    deviceValue: 'ipad',
  },
  {
    id: 'desktop',
    aliases: ['desktop', 'laptop', 'pc', 'mac', 'windows'],
    label: 'Desktop',
    deviceValue: 'desktop',
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
    evidence: ['active-card', 'saved-proof-status', 'next-recommendation', 'tiny-note-behavior'],
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    tierId: 'coach',
    session: 'day1',
    route: '/coach',
    fixture: 'coach_primary',
    requiredDevices: ['phone', 'tablet', 'desktop'],
    evidence: ['invite-link-state', 'assignment-card', 'player-challenge-screen', 'coach-review-proof'],
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    tierId: 'coach',
    session: 'day2',
    route: '/player-development/relentless-competitor-4-0/coach-planner',
    fixture: 'coach_primary',
    requiredDevices: ['tablet', 'desktop'],
    evidence: ['planner-identity', 'warm-up-block', 'skill-block', 'assignment-handoff'],
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    tierId: 'player_plus',
    session: 'day2',
    route: '/mylab',
    fixture: 'player_plus_linked',
    requiredDevices: ['phone', 'desktop'],
    evidence: ['linked-profile-state', 'identity-signal', 'next-action', 'post-refresh-state'],
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    tierId: 'captain',
    session: 'day3',
    route: '/captain',
    fixture: 'captain_primary',
    requiredDevices: ['phone', 'tablet', 'desktop'],
    evidence: ['availability-state', 'lineup-option', 'projection-scenario-result', 'team-brief-or-message'],
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    tierId: 'league',
    session: 'day4',
    route: '/league-coordinator',
    fixture: 'league_coordinator',
    requiredDevices: ['tablet', 'desktop'],
    evidence: ['result-fixture', 'coordinator-source-screen', 'public-league-screen', 'privacy-check'],
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    tierId: 'full_court',
    session: 'day5',
    route: '/pricing',
    fixture: 'full_court_operator',
    requiredDevices: ['phone', 'desktop'],
    evidence: ['pricing-tier-copy', 'player-workspace', 'coach-workspace', 'captain-workspace', 'league-workspace'],
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    tierId: 'admin_internal',
    session: 'day4',
    route: '/admin/access',
    fixture: 'admin_test',
    requiredDevices: ['desktop'],
    evidence: ['test-profile', 'starting-access', 'target-access', 'import-review-status', 'affected-surface'],
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    tierId: 'free',
    session: 'day5',
    route: '/explore',
    fixture: 'free_viewer',
    requiredDevices: ['phone', 'desktop'],
    evidence: ['explore-route', 'public-detail-page', 'pricing-handoff', 'data-assist-review-language'],
  },
]

const queryDevice = deviceProfiles.find((profile) => profile.id === normalizedQuery || profile.aliases.map(normalize).includes(normalizedQuery))
const matchingJourneys = journeys.filter(matchesQuery)
const visibleJourneys = queryDevice ? journeys.filter((journey) => journey.requiredDevices.includes(queryDevice.id)) : matchingJourneys
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
  const requiredDevices = activeDeviceId ? journey.requiredDevices.filter((deviceId) => deviceId === activeDeviceId) : journey.requiredDevices

  return requiredDevices.map((deviceId) => {
    const device = deviceProfiles.find((profile) => profile.id === deviceId)
    const deviceValue = device?.deviceValue ?? deviceId
    const evidenceCell = journey.evidence
      .map((evidenceName) => `${options.date || 'yyyy-mm-dd'}-${journey.session}-${journey.id}-${evidenceName}-${deviceValue}-${slug(options.tester || 'tester')}.png`)
      .join('; ')

    return {
      journeyId: journey.id,
      label: journey.label,
      tierId: journey.tierId,
      route: journey.route,
      fixture: journey.fixture,
      deviceValue,
      deviceLabel: device?.label ?? deviceId,
      evidenceCell,
    }
  })
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
