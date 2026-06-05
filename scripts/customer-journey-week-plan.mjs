const options = parseArgs(process.argv.slice(2))
const tester = options.tester || '<name>'
const date = options.date || 'yyyy-mm-dd'

const deviceProfiles = {
  phone: {
    label: 'Phone',
    value: 'phone',
    reason: 'Proves fast actions, tap targets, collapse behavior, and no hidden next step.',
  },
  tablet: {
    label: 'Tablet / iPad',
    value: 'ipad',
    reason: 'Proves lesson/planner/workflow usability on the device most likely used court-side.',
  },
  desktop: {
    label: 'Desktop',
    value: 'desktop',
    reason: 'Proves operations, admin, lineup, and review workflows with full context visible.',
  },
}

const weeklyPlan = [
  {
    id: 'day1',
    label: 'Day 1',
    focus: 'Trust Loop',
    question: 'Can player proof and coach assignment close the trust loop without sync or mobile confusion?',
    journeys: [
      {
        id: 'player-level-up-mobile-loop',
        route: '/player-development/relentless-competitor-4-0/level-up',
        fixture: 'player_plus_linked',
        devices: ['phone', 'tablet'],
        risk: 'Player starts useful work and saves proof without extra scroll or fake sync.',
      },
      {
        id: 'coach-player-assigned-challenge',
        route: '/coach',
        fixture: 'coach_primary',
        devices: ['phone', 'tablet', 'desktop'],
        risk: 'Coach assignment and player proof close the loop across roles.',
      },
    ],
  },
  {
    id: 'day2',
    label: 'Day 2',
    focus: 'Player And Coach Depth',
    question: 'Can recent work become a useful next lesson and a clear player return state?',
    journeys: [
      {
        id: 'coach-lesson-support',
        route: '/player-development/relentless-competitor-4-0/coach-planner',
        fixture: 'coach_primary',
        devices: ['tablet', 'desktop'],
        risk: 'Coach planner supports the player journey instead of becoming disconnected content.',
      },
      {
        id: 'player-my-lab-return-state',
        route: '/mylab',
        fixture: 'player_plus_linked',
        devices: ['phone', 'desktop'],
        risk: 'Player can return later and know what changed and what to do next.',
      },
    ],
  },
  {
    id: 'day3',
    label: 'Day 3',
    focus: 'Captain Week',
    question: 'Can a captain move from availability and context to lineup choice and team-facing communication?',
    journeys: [
      {
        id: 'captain-week-flow',
        route: '/captain',
        fixture: 'captain_primary',
        devices: ['phone', 'tablet', 'desktop'],
        risk: 'Captain workflow stays decision-focused across quick updates and full lineup planning.',
      },
    ],
  },
  {
    id: 'day4',
    label: 'Day 4',
    focus: 'League And Admin',
    question: 'Can operations, public/member context, access repair, and data review stay fixture-safe and connected?',
    journeys: [
      {
        id: 'league-result-to-public-context',
        route: '/league-coordinator',
        fixture: 'league_coordinator',
        devices: ['tablet', 'desktop'],
        risk: 'Coordinator operations connect to public/member context without exposing private controls.',
      },
      {
        id: 'admin-access-and-data-quality',
        route: '/admin/access',
        fixture: 'admin_test',
        devices: ['desktop'],
        risk: 'Access and data repair stay safe, traceable, and reflected in the affected product surface.',
      },
    ],
  },
  {
    id: 'day5',
    label: 'Day 5',
    focus: 'Full-Court And Free/Public Regression',
    question: 'Can multi-role access and free discovery work without stale locks or premature upgrade pressure?',
    journeys: [
      {
        id: 'full-court-access-pass',
        route: '/pricing',
        fixture: 'full_court_operator',
        devices: ['phone', 'desktop'],
        risk: 'Paid workspaces open cleanly without stale locks or redundant upgrade prompts.',
      },
      {
        id: 'free-public-discovery',
        route: '/explore',
        fixture: 'free_viewer',
        devices: ['phone', 'desktop'],
        risk: 'Free user sees useful tennis intelligence before upgrade or data-assist handoff.',
      },
    ],
  },
]

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
