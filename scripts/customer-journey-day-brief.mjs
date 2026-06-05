const options = parseArgs(process.argv.slice(2))
const rawQuery = options.session.trim().toLowerCase()
const normalizedQuery = rawQuery.replace(/\s+/g, '').replace('-', '')

const sessions = [
  {
    id: 'day1',
    aliases: ['1', 'day1', 'trustloop'],
    label: 'Day 1',
    focus: 'Trust Loop',
    question: 'Can player proof and coach assignment close the trust loop without sync or mobile confusion?',
    journeyIds: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
    fixtures: ['player_plus_linked', 'coach_primary', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
  },
  {
    id: 'day2',
    aliases: ['2', 'day2', 'playercoach'],
    label: 'Day 2',
    focus: 'Player And Coach Depth',
    question: 'Can recent work become a useful next lesson and a clear player return state?',
    journeyIds: ['coach-lesson-support', 'player-my-lab-return-state'],
    fixtures: ['coach_primary', 'player_plus_linked', 'linked-player-profile', 'level-up-assignment'],
  },
  {
    id: 'day3',
    aliases: ['3', 'day3', 'captain'],
    label: 'Day 3',
    focus: 'Captain Week',
    question: 'Can a captain move from availability and context to lineup choice and team-facing communication?',
    journeyIds: ['captain-week-flow'],
    fixtures: ['captain_primary', 'captain-team-week'],
  },
  {
    id: 'day4',
    aliases: ['4', 'day4', 'leagueadmin'],
    label: 'Day 4',
    focus: 'League And Admin',
    question: 'Can operations, public/member context, access repair, and data review stay fixture-safe and connected?',
    journeyIds: ['league-result-to-public-context', 'admin-access-and-data-quality'],
    fixtures: ['league_coordinator', 'league-week', 'admin_test', 'admin-access-repair', 'data-assist-upload'],
  },
  {
    id: 'day5',
    aliases: ['5', 'day5', 'regression'],
    label: 'Day 5',
    focus: 'Full-Court And Free/Public Regression',
    question: 'Can multi-role access and free discovery work without stale locks or premature upgrade pressure?',
    journeyIds: ['full-court-access-pass', 'free-public-discovery'],
    fixtures: ['full_court_operator', 'full-court-access-state', 'free_viewer', 'data-assist-upload'],
  },
]

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    entryRoute: '/player-development/relentless-competitor-4-0/level-up',
    accountFixture: 'player_plus_linked',
    passSignal: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
    evidence: ['phone screenshot of active card', 'saved proof status text', 'next recommendation', 'tiny note behavior'],
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    entryRoute: '/coach',
    accountFixture: 'coach_primary',
    passSignal: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
    evidence: ['invite link state', 'assignment id', 'player challenge screen', 'coach review screen', 'proof rating and note'],
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    entryRoute: '/player-development/relentless-competitor-4-0/coach-planner',
    accountFixture: 'coach_primary',
    passSignal: 'The planner is coach-facing, practical, and connected to the player Level Up path.',
    evidence: ['planner identity', 'warm-up block', 'skill block', 'pressure block', 'assignment handoff'],
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    entryRoute: '/mylab',
    accountFixture: 'player_plus_linked',
    passSignal: 'My Lab makes the player identity, linked profile, and next action clear after refresh.',
    evidence: ['linked profile state', 'identity signal', 'next action', 'post-refresh state'],
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    entryRoute: '/captain',
    accountFixture: 'captain_primary',
    passSignal: 'Captain can make a weekly decision and produce a useful team-facing update.',
    evidence: ['availability state', 'lineup option', 'projection/scenario result', 'team brief or message'],
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    entryRoute: '/league-coordinator',
    accountFixture: 'league_coordinator',
    passSignal: 'Coordinator operation and member-facing league context stay connected without exposing private controls.',
    evidence: ['result fixture', 'coordinator source screen', 'public league screen', 'privacy check'],
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    entryRoute: '/pricing',
    accountFixture: 'full_court_operator',
    passSignal: 'All paid workspaces open cleanly and the user can tell which workspace fits the job.',
    evidence: ['pricing tier copy', 'Player workspace', 'Coach workspace', 'Captain workspace', 'League workspace'],
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    entryRoute: '/admin/access',
    accountFixture: 'admin_test',
    passSignal: 'Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces.',
    evidence: ['test profile', 'starting access', 'target access', 'import review status', 'affected surface'],
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    entryRoute: '/explore',
    accountFixture: 'free_viewer',
    passSignal: 'Public tennis intelligence is visible first, and upgrade/data-assist paths are clear.',
    evidence: ['Explore route', 'public detail page', 'pricing handoff', 'Data Assist review language'],
  },
]
const journeyById = new Map(journeys.map((journey) => [journey.id, journey]))
const session = sessions.find((item) => item.aliases.includes(normalizedQuery))

console.log('TenAceIQ Customer Journey Day Driver')
console.log('')

if (!session) {
  console.log('Usage: npm run qa:day -- <day1 | day2 | day3 | day4 | day5>')
  console.log('       npm run qa:day -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>')
  console.log('')
  console.log('Available sessions:')
  for (const item of sessions) {
    console.log(`- ${item.id}: ${item.label} - ${item.focus}`)
  }
  process.exit(rawQuery ? 1 : 0)
}

console.log(`${session.label}: ${session.focus}`)
console.log(`Question: ${session.question}`)
if (options.date || options.tester || options.deviceBrowser) {
  console.log(
    `Defaults: date=${options.date || 'blank'}, tester=${options.tester || 'blank'}, device/browser=${options.deviceBrowser || 'blank'}`
  )
}
console.log('')

console.log('Fixtures:')
for (const fixture of session.fixtures) console.log(`- ${fixture}`)
console.log('')

console.log('Walk these journeys:')
for (const journeyId of session.journeyIds) {
  const journey = journeyById.get(journeyId)
  if (!journey) continue

  console.log(`- ${journey.label} (${journey.id})`)
  console.log(`  Route: ${journey.entryRoute}`)
  console.log(`  Fixture: ${journey.accountFixture}`)
  console.log(`  Pass: ${journey.passSignal}`)
  console.log(`  Evidence: ${journey.evidence.join('; ')}`)
}
console.log('')

console.log('Paste-ready ledger rows:')
console.log('| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
for (const journeyId of session.journeyIds) {
  const journey = journeyById.get(journeyId)
  if (!journey) continue

  console.log(
    `| ${formatCell(options.date)} | ${formatCell(options.tester)} | ${formatCell(options.deviceBrowser)} | ${journey.accountFixture} | ${journey.id} | ${journey.entryRoute} | needs-follow-up |  |  |  |  |  |`
  )
}
console.log('')

console.log('After testing:')
console.log('- npm run qa:ledger-check')
console.log(`- npm run qa:session-status -- ${session.id}`)
console.log(`- npm run qa:retest -- ${session.id}`)
console.log(options.date ? `- npm run qa:daily-summary -- ${options.date}` : '- npm run qa:daily-summary -- <yyyy-mm-dd>')
console.log('- npm run qa:results')
console.log('')
console.log('Closeout rule: do not mark pass unless the evidence proves the pain point was solved, not just that the page loaded.')

function parseArgs(args) {
  const parsed = {
    session: '',
    date: '',
    tester: '',
    deviceBrowser: '',
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
    if (key === 'device' || key === 'browser' || key === 'device-browser') parsed.deviceBrowser = value
  }

  return parsed
}

function formatCell(value) {
  return value.trim().replace(/\|/g, '/')
}
