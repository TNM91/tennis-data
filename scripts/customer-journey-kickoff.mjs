import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const options = parseArgs(process.argv.slice(2))
const rawQuery = options.query.trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)
const normalizedDevice = normalize(options.device || 'phone')
const date = options.date || 'yyyy-mm-dd'
const tester = options.tester || '<name>'

const tierLabels = {
  free: 'Free',
  player_plus: 'Player+',
  coach: 'Coach',
  captain: 'Captain',
  league: 'TIQ League Coordinator/Admin',
  full_court: 'Full-Court',
  admin_internal: 'Admin/Internal',
}

const devices = [
  { id: 'phone', aliases: ['phone', 'mobile', 'iphone', 'ios', 'android'], label: 'Phone', value: 'phone', viewport: '390 x 844' },
  { id: 'tablet', aliases: ['tablet', 'ipad'], label: 'Tablet / iPad', value: 'ipad', viewport: '820 x 1180' },
  { id: 'desktop', aliases: ['desktop', 'laptop', 'pc', 'mac', 'windows'], label: 'Desktop', value: 'desktop', viewport: '1440 x 1000' },
]

const sessions = [
  {
    id: 'day1',
    label: 'Day 1',
    focus: 'Trust Loop',
    aliases: ['1', 'trust-loop', 'trustloop'],
    journeyIds: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
  },
  {
    id: 'day2',
    label: 'Day 2',
    focus: 'Player And Coach Depth',
    aliases: ['2', 'player-coach', 'playercoach'],
    journeyIds: ['coach-lesson-support', 'player-my-lab-return-state'],
  },
  {
    id: 'day3',
    label: 'Day 3',
    focus: 'Captain Week',
    aliases: ['3', 'captain'],
    journeyIds: ['captain-week-flow'],
  },
  {
    id: 'day4',
    label: 'Day 4',
    focus: 'League And Admin',
    aliases: ['4', 'league-admin', 'leagueadmin'],
    journeyIds: ['league-result-to-public-context', 'admin-access-and-data-quality'],
  },
  {
    id: 'day5',
    label: 'Day 5',
    focus: 'Full-Court And Free/Public Regression',
    aliases: ['5', 'regression'],
    journeyIds: ['full-court-access-pass', 'free-public-discovery'],
  },
]

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    tierId: 'player_plus',
    risk: 'critical',
    personaFixture: 'player_plus_linked',
    fixtureIds: ['player_plus_linked', 'level-up-completion'],
    featureIds: ['player-level-up', 'player-level-up-content'],
    entryRoute: '/player-development/relentless-competitor-4-0/level-up',
    requiredDevices: ['phone', 'tablet'],
    primaryQuestion: 'Can a player start useful tennis work on a phone, score proof, and know the next rep without extra scrolling?',
    successSignal: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
    evidenceToCapture: ['phone screenshot of active card', 'saved proof status text', 'next recommendation', 'tiny note behavior'],
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    tierId: 'coach',
    risk: 'critical',
    personaFixture: 'coach_primary',
    fixtureIds: ['coach_primary', 'player_plus_linked', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
    featureIds: ['coach-hub', 'coach-invite-link', 'player-level-up'],
    entryRoute: '/coach',
    requiredDevices: ['phone', 'tablet', 'desktop'],
    primaryQuestion: 'Can a coach assign one useful tool and see the player proof come back through the linked relationship?',
    successSignal: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
    evidenceToCapture: ['invite link state', 'assignment id', 'player challenge screen', 'coach review screen', 'proof rating and note'],
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    tierId: 'coach',
    risk: 'high',
    personaFixture: 'coach_primary',
    fixtureIds: ['coach_primary', 'linked-player-profile', 'level-up-assignment'],
    featureIds: ['coach-lesson-planner', 'player-level-up-content'],
    entryRoute: '/player-development/relentless-competitor-4-0/coach-planner',
    requiredDevices: ['tablet', 'desktop'],
    primaryQuestion: 'Can the coach turn identity, readiness, and assigned work into a useful one-hour lesson plan?',
    successSignal: 'The planner is coach-facing, practical, and connected to the player Level Up path.',
    evidenceToCapture: ['planner identity', 'warm-up block', 'skill block', 'pressure block', 'assignment handoff'],
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    tierId: 'player_plus',
    risk: 'high',
    personaFixture: 'player_plus_linked',
    fixtureIds: ['player_plus_linked', 'linked-player-profile'],
    featureIds: ['player-my-lab'],
    entryRoute: '/mylab',
    requiredDevices: ['phone', 'desktop'],
    primaryQuestion: 'Can a player come back later and understand their personal tennis context and next useful action?',
    successSignal: 'My Lab makes the player identity, linked profile, and next action clear after refresh.',
    evidenceToCapture: ['linked profile state', 'identity signal', 'next action', 'post-refresh state'],
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    tierId: 'captain',
    risk: 'high',
    personaFixture: 'captain_primary',
    fixtureIds: ['captain_primary', 'captain-team-week'],
    featureIds: ['captain-lineup-week', 'captain-compete-bridge'],
    entryRoute: '/captain',
    requiredDevices: ['phone', 'tablet', 'desktop'],
    primaryQuestion: 'Can a captain move from availability and scouting to lineup choice and team communication?',
    successSignal: 'Captain can make a weekly decision and produce a useful team-facing update.',
    evidenceToCapture: ['availability state', 'lineup option', 'projection/scenario result', 'team brief or message'],
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    tierId: 'league',
    risk: 'high',
    personaFixture: 'league_coordinator',
    fixtureIds: ['league_coordinator', 'league-week'],
    featureIds: ['league-office', 'league-public-context'],
    entryRoute: '/league-coordinator',
    requiredDevices: ['tablet', 'desktop'],
    primaryQuestion: 'Can a coordinator record or review league results and see the intended public/member context update?',
    successSignal: 'Coordinator operation and member-facing league context stay connected without exposing private controls.',
    evidenceToCapture: ['result fixture', 'coordinator source screen', 'public league screen', 'privacy check'],
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    tierId: 'full_court',
    risk: 'medium',
    personaFixture: 'full_court_operator',
    fixtureIds: ['full_court_operator', 'full-court-access-state'],
    featureIds: ['full-court-navigation'],
    entryRoute: '/pricing',
    requiredDevices: ['phone', 'desktop'],
    primaryQuestion: 'Can a multi-role user move through Player, Coach, Captain, and League surfaces without stale locks?',
    successSignal: 'All paid workspaces open cleanly and the user can tell which workspace fits the job.',
    evidenceToCapture: ['pricing tier copy', 'Player workspace', 'Coach workspace', 'Captain workspace', 'League workspace'],
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    tierId: 'admin_internal',
    risk: 'high',
    personaFixture: 'admin_test',
    fixtureIds: ['admin_test', 'admin-access-repair', 'data-assist-upload'],
    featureIds: ['admin-access-management', 'admin-data-quality', 'free-data-assist-entry'],
    entryRoute: '/admin/access',
    requiredDevices: ['desktop'],
    primaryQuestion: 'Can internal users repair access and protect imported tennis data without changing real customer data?',
    successSignal: 'Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces.',
    evidenceToCapture: ['test profile', 'starting access', 'target access', 'import review status', 'affected surface'],
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    tierId: 'free',
    risk: 'medium',
    personaFixture: 'free_viewer',
    fixtureIds: ['free_viewer', 'data-assist-upload'],
    featureIds: ['free-public-explore', 'free-data-assist-entry'],
    entryRoute: '/explore',
    requiredDevices: ['phone', 'desktop'],
    primaryQuestion: 'Can a visitor find useful tennis context before being asked to upgrade?',
    successSignal: 'Public tennis intelligence is visible first, and upgrade/data-assist paths are clear.',
    evidenceToCapture: ['Explore route', 'public detail page', 'pricing handoff', 'Data Assist review language'],
  },
]

const rows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)

const selectedDevice = devices.find((device) => device.id === normalizedDevice || device.aliases.map(normalize).includes(normalizedDevice)) ?? devices[0]
const matches = getMatches()

console.log('TenAceIQ Journey Kickoff')
console.log('')
console.log('Use this when you are about to test one journey and need the route, fixtures, device, evidence, ledger row, and closeout gates in one place.')
console.log(`Source: ${resultsPath}`)
console.log('')

if (!matches.length) {
  if (rawQuery) {
    console.log(`No journey matched "${rawQuery}".`)
    console.log('')
  }
  printUsage()
  process.exit(rawQuery ? 1 : 0)
}

for (const journey of matches) printKickoff(journey)

console.log('Kickoff rule: do not start browser proof from memory. Confirm fixtures, capture named evidence, paste one honest ledger row, then run the closeout gates.')

function getMatches() {
  if (!rawQuery) return [getNextJourney()]

  const session = sessions.find((item) => item.id === normalizedQuery || item.aliases.map(normalize).includes(normalizedQuery))
  if (session) return session.journeyIds.map((journeyId) => journeys.find((journey) => journey.id === journeyId)).filter(Boolean)

  const tierId = Object.entries(tierLabels).find(([id, label]) => {
    const normalizedLabel = normalize(label)

    return normalize(id) === normalizedQuery || normalizedLabel === normalizedQuery
  })?.[0]

  if (tierId) return journeys.filter((journey) => journey.tierId === tierId)

  const exact = journeys.find((journey) => journey.id === normalizedQuery || normalize(journey.label) === normalizedQuery)
  if (exact) return [exact]

  return journeys.filter((journey) =>
    [
      journey.id,
      journey.label,
      journey.tierId,
      journey.personaFixture,
      journey.entryRoute,
      ...journey.fixtureIds,
      ...journey.featureIds,
      ...journey.evidenceToCapture,
    ]
      .join(' ')
      .toLowerCase()
      .includes(rawQuery),
  )
}

function getNextJourney() {
  return journeys.find((journey) => {
    const journeyRows = rows.filter((row) => row.journeyId === journey.id)
    return !journeyRows.some((row) => row.result === 'pass' && row.screenshotOrVideo)
  }) ?? journeys[0]
}

function printKickoff(journey) {
  const session = sessions.find((item) => item.journeyIds.includes(journey.id))
  const latestRow = rows.filter((row) => row.journeyId === journey.id).at(-1)
  const fixtureQuery = journey.fixtureIds[0] ?? journey.personaFixture
  const device = journey.requiredDevices.includes(selectedDevice.id) ? selectedDevice : devices.find((item) => journey.requiredDevices.includes(item.id)) ?? selectedDevice
  const resultState = latestRow
    ? `${latestRow.result || 'logged'}${latestRow.category ? `/${latestRow.category}` : ''}${latestRow.screenshotOrVideo ? ' with evidence' : ' without evidence'}`
    : 'missing result row'

  console.log(`${journey.label} (${journey.id})`)
  console.log(`Tier: ${tierLabels[journey.tierId]} | Session: ${session?.id ?? 'unassigned'} | Risk: ${journey.risk}`)
  console.log(`Device: ${device.label} (${device.viewport}) | Required devices: ${journey.requiredDevices.join(', ')}`)
  console.log(`Route: ${journey.entryRoute}`)
  console.log(`Fixture: ${journey.personaFixture}`)
  console.log(`Ledger state: ${resultState}`)
  console.log('')
  console.log(`Question: ${journey.primaryQuestion}`)
  console.log(`Pass signal: ${journey.successSignal}`)
  console.log('')
  console.log('Run order:')
  console.log(`1. npm run qa:fixture-board -- ${fixtureQuery}`)
  console.log(`2. npm run qa:fixture-status -- ${session?.id ?? journey.id}`)
  console.log(`3. npm run qa:tester-packet -- ${session?.id ?? 'day1'} --device=${device.id} --date=${date} --tester=${slug(tester)}`)
  console.log(`4. npm run qa:evidence-pack -- ${session?.id ?? 'day1'} --date=${date} --tester=${slug(tester)} --device=${device.value}`)
  console.log(`5. npm run qa:live-card -- ${journey.id} --date=${date} --tester=${slug(tester)} --device=${device.value}`)
  console.log(`6. Open ${journey.entryRoute} with ${journey.personaFixture}.`)
  console.log('7. Capture the proof below and paste/update the ledger row.')
  console.log('8. npm run qa:ledger-check')
  console.log(`9. npm run qa:session-status -- ${session?.id ?? journey.id}`)
  console.log('')
  console.log('Journey evidence to capture:')
  for (const evidence of journey.evidenceToCapture) console.log(`- ${evidence}`)
  console.log('')
  console.log('Paste-ready ledger row:')
  console.log('| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |')
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  console.log(
    `| ${date} | ${tester} | ${device.value} | ${journey.personaFixture} | ${journey.id} | ${journey.entryRoute} | needs-follow-up |  |  |  |  | npm run qa:live-card -- ${journey.id} --date=${date} --tester=${slug(tester)} --device=${device.value} |`,
  )
  console.log('')
  console.log('If blocked:')
  console.log('- fixture-gap: missing account, linked state, or safe data.')
  console.log('- mobile-ux-gap: too much scroll, weak tap targets, overlap, or hidden next action.')
  console.log('- content-quality-gap: page loads but does not help the tester act.')
  console.log('')
}

function printUsage() {
  console.log('Usage: npm run qa:kickoff -- <journey-id | day1-day5 | tier | search> --device=<phone|tablet|desktop> --date=yyyy-mm-dd --tester=<name>')
  console.log('')
  console.log('Examples:')
  console.log('- npm run qa:kickoff -- player-level-up-mobile-loop --device=phone --date=2026-06-05 --tester=nick')
  console.log('- npm run qa:kickoff -- day1 --device=tablet --date=2026-06-05 --tester=nick')
  console.log('- npm run qa:kickoff -- coach --device=desktop')
  console.log('')
  console.log('No query defaults to the first journey missing pass evidence.')
}

function parseArgs(args) {
  const parsed = {
    query: '',
    device: '',
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
    if (key === 'device' || key === 'browser' || key === 'device-browser') parsed.device = value
  }

  return parsed
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

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function slug(value) {
  return normalize(value || 'tester')
}
