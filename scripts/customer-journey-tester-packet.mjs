const options = parseArgs(process.argv.slice(2))
const rawSession = options.session.trim().toLowerCase()
const normalizedSession = normalize(rawSession)
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

const sessions = [
  {
    id: 'day1',
    aliases: ['1', 'day1', 'trustloop', 'trust-loop'],
    label: 'Day 1',
    focus: 'Trust Loop',
    question: 'Can player proof and coach assignment close the trust loop without sync or mobile confusion?',
    journeyIds: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
  },
  {
    id: 'day2',
    aliases: ['2', 'day2', 'playercoach', 'player-coach'],
    label: 'Day 2',
    focus: 'Player And Coach Depth',
    question: 'Can recent work become a useful next lesson and a clear player return state?',
    journeyIds: ['coach-lesson-support', 'player-my-lab-return-state'],
  },
  {
    id: 'day3',
    aliases: ['3', 'day3', 'captain'],
    label: 'Day 3',
    focus: 'Captain Week',
    question: 'Can a captain move from availability and context to lineup choice and team-facing communication?',
    journeyIds: ['captain-week-flow'],
  },
  {
    id: 'day4',
    aliases: ['4', 'day4', 'leagueadmin', 'league-admin'],
    label: 'Day 4',
    focus: 'League And Admin',
    question: 'Can operations, public/member context, access repair, and data review stay fixture-safe and connected?',
    journeyIds: ['league-result-to-public-context', 'admin-access-and-data-quality'],
  },
  {
    id: 'day5',
    aliases: ['5', 'day5', 'regression'],
    label: 'Day 5',
    focus: 'Full-Court And Free/Public Regression',
    question: 'Can multi-role access and free discovery work without stale locks or premature upgrade pressure?',
    journeyIds: ['full-court-access-pass', 'free-public-discovery'],
  },
]

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    route: '/player-development/relentless-competitor-4-0/level-up',
    fixture: 'player_plus_linked',
    requiredDevices: ['phone', 'tablet'],
    passSignal: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
    evidence: ['active card', 'saved proof status', 'next recommendation', 'tiny note behavior'],
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    route: '/coach',
    fixture: 'coach_primary',
    requiredDevices: ['phone', 'tablet', 'desktop'],
    passSignal: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
    evidence: ['invite link state', 'assignment card', 'player challenge screen', 'coach review proof'],
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    route: '/player-development/relentless-competitor-4-0/coach-planner',
    fixture: 'coach_primary',
    requiredDevices: ['tablet', 'desktop'],
    passSignal: 'The planner is coach-facing, practical, and connected to the player Level Up path.',
    evidence: ['planner identity', 'warm-up block', 'skill block', 'assignment handoff'],
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    route: '/mylab',
    fixture: 'player_plus_linked',
    requiredDevices: ['phone', 'desktop'],
    passSignal: 'My Lab makes the player identity, linked profile, and next action clear after refresh.',
    evidence: ['linked profile state', 'identity signal', 'next action', 'post-refresh state'],
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    route: '/captain',
    fixture: 'captain_primary',
    requiredDevices: ['phone', 'tablet', 'desktop'],
    passSignal: 'Captain can make a weekly decision and produce a useful team-facing update.',
    evidence: ['availability state', 'lineup option', 'projection scenario result', 'team brief or message'],
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    route: '/league-coordinator',
    fixture: 'league_coordinator',
    requiredDevices: ['tablet', 'desktop'],
    passSignal: 'Coordinator operation and member-facing league context stay connected without exposing private controls.',
    evidence: ['result fixture', 'coordinator source screen', 'public league screen', 'privacy check'],
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    route: '/pricing',
    fixture: 'full_court_operator',
    requiredDevices: ['phone', 'desktop'],
    passSignal: 'All paid workspaces open cleanly and the user can tell which workspace fits the job.',
    evidence: ['pricing tier copy', 'player workspace', 'coach workspace', 'captain workspace', 'league workspace'],
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    route: '/admin/access',
    fixture: 'admin_test',
    requiredDevices: ['desktop'],
    passSignal: 'Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces.',
    evidence: ['test profile', 'starting access', 'target access', 'import review status', 'affected surface'],
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    route: '/explore',
    fixture: 'free_viewer',
    requiredDevices: ['phone', 'desktop'],
    passSignal: 'Public tennis intelligence is visible first, and upgrade/data-assist paths are clear.',
    evidence: ['explore route', 'public detail page', 'pricing handoff', 'data assist review language'],
  },
]

const session = sessions.find((item) => item.aliases.map(normalize).includes(normalizedSession))
const device = deviceProfiles.find((profile) => profile.id === normalizedDevice || profile.aliases.map(normalize).includes(normalizedDevice))
const journeyById = new Map(journeys.map((journey) => [journey.id, journey]))
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
  for (const item of sessions) console.log(`- ${item.id}: ${item.label} - ${item.focus}`)
  console.log('')
  console.log('Available devices:')
  for (const item of deviceProfiles) console.log(`- ${item.id}: ${item.label} (${item.viewport})`)
  process.exit(rawSession || options.device ? 1 : 0)
}

const sessionJourneys = session.journeyIds.map((journeyId) => journeyById.get(journeyId)).filter(Boolean)
const deviceJourneys = sessionJourneys.filter((journey) => journey.requiredDevices.includes(device.id))
const skippedJourneys = sessionJourneys.filter((journey) => !journey.requiredDevices.includes(device.id))

console.log(`${session.label}: ${session.focus}`)
console.log(`Question: ${session.question}`)
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
  console.log(`  Route: ${journey.route}`)
  console.log(`  Fixture: ${journey.fixture}`)
  console.log(`  Pass: ${journey.passSignal}`)
  console.log(`  Capture: ${journey.evidence.join('; ')}`)
  console.log(`  Live card: npm run qa:live-card -- ${journey.id} --date=${date} --tester=${slug(tester)} --device=${device.value}`)
}

if (skippedJourneys.length) {
  console.log('')
  console.log('Not Required For This Device:')
  for (const journey of skippedJourneys) {
    console.log(`- ${journey.label} (${journey.id}) requires ${journey.requiredDevices.join(', ')}`)
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
