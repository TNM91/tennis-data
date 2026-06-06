import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const flowMapPath = 'lib/customer-journey-flow-map.json'
const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)
const tierAliases = {
  free: 'free',
  player: 'player_plus',
  playerplus: 'player_plus',
  player_plus: 'player_plus',
  coach: 'coach',
  captain: 'captain',
  league: 'league',
  coordinator: 'league',
  fullcourt: 'full_court',
  full_court: 'full_court',
  admin: 'admin_internal',
  internal: 'admin_internal',
}

const sessions = [
  {
    id: 'day1',
    label: 'Day 1',
    focus: 'Player and coach trust loop',
    journeys: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
  },
  {
    id: 'day2',
    label: 'Day 2',
    focus: 'Coach support and Player return state',
    journeys: ['coach-lesson-support', 'player-my-lab-return-state'],
  },
  {
    id: 'day3',
    label: 'Day 3',
    focus: 'Captain decision flow',
    journeys: ['captain-week-flow'],
  },
  {
    id: 'day4',
    label: 'Day 4',
    focus: 'League, admin, and data quality',
    journeys: ['league-result-to-public-context', 'admin-access-and-data-quality'],
  },
  {
    id: 'day5',
    label: 'Day 5',
    focus: 'Access, Free/Public, and final regression',
    journeys: ['full-court-access-pass', 'free-public-discovery'],
  },
]

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    tierId: 'player_plus',
    flowId: 'player-practice-progress-loop',
    route: '/player-development/relentless-competitor-4-0/level-up',
    fixture: 'player_plus_linked',
    passSignal: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    tierId: 'coach',
    flowId: 'coach-assignment-lesson-loop',
    route: '/coach',
    fixture: 'coach_primary',
    passSignal: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    tierId: 'coach',
    flowId: 'coach-assignment-lesson-loop',
    route: '/player-development/relentless-competitor-4-0/coach-planner',
    fixture: 'coach_primary',
    passSignal: 'The planner is coach-facing, practical, and connected to the player Level Up path.',
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    tierId: 'player_plus',
    flowId: 'player-practice-progress-loop',
    route: '/mylab',
    fixture: 'player_plus_linked',
    passSignal: 'My Lab makes the player identity, linked profile, and next action clear after refresh.',
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    tierId: 'captain',
    flowId: 'captain-week-decision-loop',
    route: '/captain',
    fixture: 'captain_primary',
    passSignal: 'Captain can make a weekly decision and produce a useful team-facing update.',
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    tierId: 'league',
    flowId: 'league-operation-visibility-loop',
    route: '/league-coordinator',
    fixture: 'league_coordinator',
    passSignal: 'Coordinator operation and member-facing league context stay connected without exposing private controls.',
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    tierId: 'admin_internal',
    flowId: 'admin-access-data-quality-loop',
    route: '/admin/access',
    fixture: 'admin_test',
    passSignal: 'Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces.',
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    tierId: 'full_court',
    flowId: 'full-court-role-switching-loop',
    route: '/pricing',
    fixture: 'full_court_operator',
    passSignal: 'All paid workspaces open cleanly and the user can tell which workspace fits the job.',
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    tierId: 'free',
    flowId: 'free-discovery-to-upgrade',
    route: '/explore',
    fixture: 'free_viewer',
    passSignal: 'Public tennis intelligence is visible first, and upgrade/data-assist paths are clear.',
  },
]

const flowMaps = JSON.parse(readFileSync(join(process.cwd(), flowMapPath), 'utf8'))
const flowById = new Map(flowMaps.map((flow) => [flow.id, flow]))
const resultRows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => !isHeaderRow(row) && !isBlankTemplateRow(row))

const selectedSessions = sessions.filter(matchesSession)

console.log('TenAceIQ Test Week Dashboard')
console.log('')
console.log(`Sources: ${flowMapPath}; ${resultsPath}`)
console.log('Use this as the compact test-week view: tier, fixture, access check, evidence proof, blocker state, and next command.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!selectedSessions.length) {
  console.log(`No testing day matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:week-dashboard -- <day1-day5 | tier | journey | fixture | route>')
  process.exit(1)
}

const selectedJourneys = selectedSessions.flatMap((session) => session.journeys.map((journeyId) => getJourney(journeyId)))
const selectedJourneyStates = selectedJourneys.map(buildJourneyState)
const signedOffCount = selectedJourneyStates.filter((state) => state.status === 'signed off').length
const blockedCount = selectedJourneyStates.filter((state) => state.status === 'blocked').length
const needsEvidenceCount = selectedJourneyStates.filter((state) => state.status === 'needs evidence').length
const missingPassCount = selectedJourneyStates.filter((state) => state.status === 'missing pass').length

console.log('Summary:')
console.log(`- Sessions: ${selectedSessions.length}`)
console.log(`- Journeys: ${selectedJourneys.length}`)
console.log(`- Signed off: ${signedOffCount}`)
console.log(`- Blocked: ${blockedCount}`)
console.log(`- Needs screenshot/video: ${needsEvidenceCount}`)
console.log(`- Missing pass: ${missingPassCount}`)
console.log('')

for (const session of selectedSessions) printSession(session)

console.log('Use with:')
console.log('- npm run qa:tester-packet -- <day1-day5> --device=<phone | tablet | desktop>')
console.log('- npm run qa:kickoff -- <journey-id>')
console.log('- npm run qa:tier-board -- <tier>')
console.log('- npm run qa:proof-gaps -- <day1-day5 | tier | journey>')
console.log('- npm run qa:close-day -- <day1-day5>')
console.log('')
console.log('Dashboard rule: do not call a day ready until every journey has pass evidence, screenshot/video proof, and no open p0/p1 row.')

function printSession(session) {
  const states = session.journeys.map((journeyId) => buildJourneyState(getJourney(journeyId)))
  const sessionStatus = getSessionStatus(states)

  console.log(`${session.label}: ${session.focus}`)
  console.log(`State: ${sessionStatus}`)
  console.log(`Next: ${getSessionNextCommand(session, states)}`)
  console.log('')

  for (const state of states) printJourneyState(session, state)

  console.log('')
}

function printJourneyState(session, state) {
  const { journey, flow } = state

  console.log(`- ${state.status}: ${journey.label} (${journey.id})`)
  console.log(`  Tier/route: ${journey.tierId}; ${journey.route}`)
  console.log(`  Fixture: ${journey.fixture}; flow fixtures: ${flow.fixtureIds.join(', ')}`)
  console.log(`  Access check: ${flow.accessCheck}`)
  console.log(`  Evidence: ${flow.evidenceArtifact}`)
  console.log(`  Return proof: ${flow.returnStateProof}`)
  console.log(`  Pass signal: ${journey.passSignal}`)

  if (state.openHighPriorityRows.length) {
    for (const row of state.openHighPriorityRows) {
      console.log(`  Blocker: ${row.severity} ${row.category || 'category missing'}; ${row.nextAction || 'missing next action'}`)
    }
  }

  console.log(`  Next command: ${getJourneyNextCommand(session, state)}`)
}

function buildJourneyState(journey) {
  const flow = flowById.get(journey.flowId)

  if (!flow) {
    console.error(`${journey.id} references missing flow ${journey.flowId}.`)
    process.exit(1)
  }

  const rows = resultRows.filter((row) => row.journeyId === journey.id)
  const passRows = rows.filter((row) => row.result === 'pass')
  const hasPassEvidence = passRows.some((row) => row.screenshotOrVideo)
  const openHighPriorityRows = rows.filter((row) => row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))

  let status = 'signed off'
  if (openHighPriorityRows.length) status = 'blocked'
  else if (!passRows.length) status = 'missing pass'
  else if (!hasPassEvidence) status = 'needs evidence'

  return {
    journey,
    flow,
    rows,
    passRows,
    openHighPriorityRows,
    status,
  }
}

function getSessionStatus(states) {
  if (states.some((state) => state.status === 'blocked')) return 'blocked'
  if (states.some((state) => state.status === 'missing pass')) return 'needs pass'
  if (states.some((state) => state.status === 'needs evidence')) return 'needs evidence'
  return 'ready'
}

function getSessionNextCommand(session, states) {
  const blocked = states.find((state) => state.status === 'blocked')
  if (blocked) return `npm run qa:action-list -- ${blocked.journey.id}`

  const missingPass = states.find((state) => state.status === 'missing pass')
  if (missingPass) return `npm run qa:kickoff -- ${missingPass.journey.id}`

  const needsEvidence = states.find((state) => state.status === 'needs evidence')
  if (needsEvidence) return `npm run qa:evidence-pack -- ${session.id}`

  return `npm run qa:close-day -- ${session.id}`
}

function getJourneyNextCommand(session, state) {
  if (state.status === 'blocked') return `npm run qa:action-list -- ${state.journey.id}`
  if (state.status === 'missing pass') return `npm run qa:kickoff -- ${state.journey.id}`
  if (state.status === 'needs evidence') return `npm run qa:evidence-pack -- ${session.id}`
  return `npm run qa:proof-gaps -- ${state.journey.id}`
}

function matchesSession(session) {
  if (!rawQuery) return true
  if (normalize(session.id) === normalizedQuery || normalize(session.label) === normalizedQuery) return true

  const sessionJourneys = session.journeys.map(getJourney)
  const exactTierId = tierAliases[normalizedQuery.replace(/-/g, '_')] ?? tierAliases[normalizedQuery.replace(/-/g, '')]
  if (exactTierId) return sessionJourneys.some((journey) => journey.tierId === exactTierId)

  const sessionFlows = sessionJourneys.map((journey) => flowById.get(journey.flowId)).filter(Boolean)
  const haystack = [
    session.id,
    session.label,
    session.focus,
    ...session.journeys,
    ...sessionJourneys.flatMap((journey) => [journey.label, journey.tierId, journey.route, journey.fixture, journey.passSignal]),
    ...sessionFlows.flatMap((flow) => [
      flow.id,
      flow.label,
      flow.testerRole,
      flow.accessCheck,
      flow.evidenceArtifact,
      flow.returnStateProof,
      ...flow.fixtureIds,
      ...flow.primaryFeatureIds,
    ]),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(rawQuery) || normalize(haystack).includes(normalizedQuery)
}

function getJourney(journeyId) {
  const journey = journeys.find((item) => item.id === journeyId)
  if (!journey) {
    console.error(`Missing dashboard journey ${journeyId}.`)
    process.exit(1)
  }

  return journey
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
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
