const options = parseArgs(process.argv.slice(2))
const rawQuery = options.query.trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)

const deviceProfiles = [
  {
    id: 'phone',
    aliases: ['phone', 'mobile', 'iphone', 'android'],
    label: 'Phone',
    viewport: '390 x 844',
    defaultDevice: 'phone',
    priority: 'Use first for Level Up, auth, player return state, and any flow with quick actions.',
    checks: [
      'Primary action is visible without hunting.',
      'Prior selection/context collapses once work starts.',
      'Tap targets are comfortable and do not overlap.',
      'Cards, pills, tables, and notes do not force horizontal scroll.',
      'A tester can capture proof and know the next action in under one minute.',
    ],
  },
  {
    id: 'tablet',
    aliases: ['tablet', 'ipad'],
    label: 'Tablet / iPad',
    viewport: '820 x 1180',
    defaultDevice: 'ipad',
    priority: 'Use for coach lesson planning, captain decisions, league operations, and on-court review.',
    checks: [
      'Two-column layouts use the space without giant empty gaps.',
      'Side panels do not bury the active task or proof controls.',
      'Tables or dense lists remain readable without clipping.',
      'The user can move from review to action without switching pages unnecessarily.',
      'Copy still reads like an operating tool, not a marketing page.',
    ],
  },
  {
    id: 'desktop',
    aliases: ['desktop', 'laptop', 'pc'],
    label: 'Desktop',
    viewport: '1440 x 900',
    defaultDevice: 'desktop',
    priority: 'Use for admin, league, captain, coach review, and final route-level polish.',
    checks: [
      'No massive empty spacing after navigation or selections.',
      'Navigation, headers, and account controls do not overlap.',
      'The main work surface stays visually connected to the selected task.',
      'Dense data is scannable and has a clear next command.',
      'Upgrade or access messaging matches the tier being tested.',
    ],
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
    primaryDevices: ['phone', 'tablet'],
    deviceRisk: 'High phone risk: active work, proof, timer, and next action must stay close together.',
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    tierId: 'coach',
    session: 'day1',
    route: '/coach',
    fixture: 'coach_primary',
    primaryDevices: ['phone', 'tablet', 'desktop'],
    deviceRisk: 'Cross-device trust risk: coach review and player proof should not imply sync that is not real.',
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    tierId: 'coach',
    session: 'day2',
    route: '/player-development/relentless-competitor-4-0/coach-planner',
    fixture: 'coach_primary',
    primaryDevices: ['tablet', 'desktop'],
    deviceRisk: 'Planning risk: iPad and desktop should make a one-hour lesson easier, not more crowded.',
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    tierId: 'player_plus',
    session: 'day2',
    route: '/mylab',
    fixture: 'player_plus_linked',
    primaryDevices: ['phone', 'desktop'],
    deviceRisk: 'Return-state risk: recent context and next action must be obvious after refresh.',
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    tierId: 'captain',
    session: 'day3',
    route: '/captain',
    fixture: 'captain_primary',
    primaryDevices: ['phone', 'tablet', 'desktop'],
    deviceRisk: 'Decision risk: availability, lineup, projection, and team update must not feel like separate tools.',
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    tierId: 'league',
    session: 'day4',
    route: '/league-coordinator',
    fixture: 'league_coordinator',
    primaryDevices: ['tablet', 'desktop'],
    deviceRisk: 'Operations risk: result entry, review, and public/member context need clear separation.',
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    tierId: 'full_court',
    session: 'day5',
    route: '/pricing',
    fixture: 'full_court_operator',
    primaryDevices: ['phone', 'desktop'],
    deviceRisk: 'Access risk: paid workspaces should not show stale locks or redundant upgrade prompts.',
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    tierId: 'admin_internal',
    session: 'day4',
    route: '/admin/access',
    fixture: 'admin_test',
    primaryDevices: ['desktop'],
    deviceRisk: 'Admin risk: safe test data, access changes, and rollback notes must stay readable.',
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    tierId: 'free',
    session: 'day5',
    route: '/explore',
    fixture: 'free_viewer',
    primaryDevices: ['phone', 'desktop'],
    deviceRisk: 'Public risk: useful tennis context should appear before upgrade pressure.',
  },
]

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

const visibleJourneys = matches.length ? matches : journeys.filter((journey) => device && journey.primaryDevices.includes(device.id))

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
  const deviceId = profile?.id ?? journey.primaryDevices[0]
  const deviceLabel = profile?.label ?? deviceProfiles.find((item) => item.id === deviceId)?.label ?? deviceId
  const deviceName = profile?.defaultDevice ?? deviceId

  console.log(`- ${journey.label} (${journey.id})`)
  console.log(`  Tier: ${tierLabels[journey.tierId]} | Session: ${journey.session} | Device: ${deviceLabel}`)
  console.log(`  Route: ${journey.route}`)
  console.log(`  Fixture: ${journey.fixture}`)
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
    journey.session,
    journey.route,
    journey.fixture,
    journey.deviceRisk,
    ...journey.primaryDevices,
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
    console.log(`- ${journey.id} (${journey.primaryDevices.join(', ')})`)
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
