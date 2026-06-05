import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const rawQuery = process.argv[2]?.trim().toLowerCase() ?? ''
const normalizedQuery = rawQuery.replace(/\s+/g, '').replace('-', '')
const flowMaps = JSON.parse(readFileSync(join(process.cwd(), 'lib/customer-journey-flow-map.json'), 'utf8'))

const sessions = [
  {
    id: 'day1',
    label: 'Day 1',
    focus: 'Trust Loop',
    journeyIds: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
    flowIds: ['player-practice-progress-loop', 'coach-assignment-lesson-loop'],
    fixtures: ['player_plus_linked', 'coach_primary', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
    closeoutQuestion: 'Can player proof and coach assignment close the trust loop without sync or mobile confusion?',
  },
  {
    id: 'day2',
    label: 'Day 2',
    focus: 'Player And Coach Depth',
    journeyIds: ['coach-lesson-support', 'player-my-lab-return-state'],
    flowIds: ['coach-assignment-lesson-loop', 'player-practice-progress-loop'],
    fixtures: ['coach_primary', 'player_plus_linked', 'linked-player-profile', 'level-up-assignment'],
    closeoutQuestion: 'Can recent work become a useful next lesson and a clear player return state?',
  },
  {
    id: 'day3',
    label: 'Day 3',
    focus: 'Captain Week',
    journeyIds: ['captain-week-flow'],
    flowIds: ['captain-week-decision-loop'],
    fixtures: ['captain_primary', 'captain-team-week'],
    closeoutQuestion: 'Can a captain move from availability and context to lineup choice and team-facing communication?',
  },
  {
    id: 'day4',
    label: 'Day 4',
    focus: 'League And Admin',
    journeyIds: ['league-result-to-public-context', 'admin-access-and-data-quality'],
    flowIds: ['league-operation-visibility-loop', 'admin-access-data-quality-loop'],
    fixtures: ['league_coordinator', 'league-week', 'admin_test', 'admin-access-repair', 'data-assist-upload'],
    closeoutQuestion: 'Can operations, public/member context, access repair, and data review stay fixture-safe and connected?',
  },
  {
    id: 'day5',
    label: 'Day 5',
    focus: 'Full-Court And Free/Public Regression',
    journeyIds: ['full-court-access-pass', 'free-public-discovery'],
    flowIds: ['full-court-role-switching-loop', 'free-discovery-to-upgrade'],
    fixtures: ['full_court_operator', 'full-court-access-state', 'free_viewer', 'data-assist-upload'],
    closeoutQuestion: 'Can multi-role access and free discovery work without stale locks or premature upgrade pressure?',
  },
]

const aliases = {
  '1': 'day1',
  '2': 'day2',
  '3': 'day3',
  '4': 'day4',
  '5': 'day5',
  trustloop: 'day1',
  playercoach: 'day2',
  captain: 'day3',
  leagueadmin: 'day4',
  regression: 'day5',
}

const sessionId = aliases[normalizedQuery] ?? normalizedQuery
const session = sessions.find((item) => item.id === sessionId)

console.log('TenAceIQ Customer Journey Session Brief')
console.log('')

if (!session) {
  console.log('Usage: npm run qa:session -- <day1|day2|day3|day4|day5>')
  console.log('')
  console.log('Available sessions:')
  for (const item of sessions) {
    console.log(`- ${item.id}: ${item.label} - ${item.focus}`)
  }
  console.log('')
  console.log('Start with day1 unless you are rerunning a specific journey.')
  process.exit(rawQuery ? 1 : 0)
}

const flows = session.flowIds.map((flowId) => flowMaps.find((flow) => flow.id === flowId)).filter(Boolean)
const handoffs = flows.flatMap((flow) =>
  flow.handoffs.map((handoff) => ({
    fromTierId: flow.tierId,
    fromFlowId: flow.id,
    fromLabel: flow.label,
    ...handoff,
  })),
)

console.log(`${session.label}: ${session.focus}`)
console.log(`Question: ${session.closeoutQuestion}`)
console.log('')
console.log('Journeys:')
for (const journeyId of session.journeyIds) {
  console.log(`- ${journeyId}`)
}

console.log('')
console.log('Fixtures:')
for (const fixture of session.fixtures) {
  console.log(`- ${fixture}`)
}

console.log('')
console.log('Commands for this session:')
console.log('- npm run qa:status')
console.log('- npm run qa:fixtures')
for (const flow of flows) {
  console.log(`- npm run qa:focus -- ${flow.id}`)
}
console.log('- npm run qa:handoffs')
console.log('- npm run qa:evidence')
console.log('- npm run qa:triage')
console.log('- npm run qa:results')

console.log('')
console.log('Flow proof:')
for (const flow of flows) {
  console.log(`- ${flow.label} (${flow.tierId})`)
  console.log(`  Entry: ${flow.entryRoute}`)
  console.log(`  Pain point: ${flow.painPoint}`)
  console.log(`  Pass evidence: ${flow.steps.map((step) => step.evidence).join('; ')}`)
}

if (handoffs.length) {
  console.log('')
  console.log('Handoffs to verify:')
  for (const handoff of handoffs) {
    console.log(`- ${handoff.fromTierId} -> ${handoff.toTierId}: ${handoff.label}`)
    console.log(`  Proof: ${handoff.proof}`)
  }
}

console.log('')
console.log('Closeout rule: record every attempt in docs/customer-journey-test-results.md and do not mark pass unless the evidence proves the pain point was solved.')
