const options = parseArgs(process.argv.slice(2))
const rawQuery = options.session.trim().toLowerCase()
const normalizedQuery = rawQuery.replace(/\s+/g, '').replace('-', '')

const sessions = [
  {
    id: 'day1',
    aliases: ['1', 'day1', 'trustloop'],
    label: 'Day 1',
    focus: 'Trust Loop',
    journeyIds: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
  },
  {
    id: 'day2',
    aliases: ['2', 'day2', 'playercoach'],
    label: 'Day 2',
    focus: 'Player And Coach Depth',
    journeyIds: ['coach-lesson-support', 'player-my-lab-return-state'],
  },
  {
    id: 'day3',
    aliases: ['3', 'day3', 'captain'],
    label: 'Day 3',
    focus: 'Captain Week',
    journeyIds: ['captain-week-flow'],
  },
  {
    id: 'day4',
    aliases: ['4', 'day4', 'leagueadmin'],
    label: 'Day 4',
    focus: 'League And Admin',
    journeyIds: ['league-result-to-public-context', 'admin-access-and-data-quality'],
  },
  {
    id: 'day5',
    aliases: ['5', 'day5', 'regression'],
    label: 'Day 5',
    focus: 'Full-Court And Free/Public Regression',
    journeyIds: ['full-court-access-pass', 'free-public-discovery'],
  },
]

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    entryRoute: '/player-development/relentless-competitor-4-0/level-up',
    accountFixture: 'player_plus_linked',
    evidence: ['active-card', 'saved-proof-status', 'next-recommendation', 'tiny-note'],
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    entryRoute: '/coach',
    accountFixture: 'coach_primary',
    evidence: ['invite-link-state', 'assignment-card', 'player-challenge-screen', 'coach-review-proof'],
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    entryRoute: '/player-development/relentless-competitor-4-0/coach-planner',
    accountFixture: 'coach_primary',
    evidence: ['planner-identity', 'warm-up-block', 'skill-block', 'assignment-handoff'],
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    entryRoute: '/mylab',
    accountFixture: 'player_plus_linked',
    evidence: ['linked-profile-state', 'identity-signal', 'next-action', 'post-refresh-state'],
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    entryRoute: '/captain',
    accountFixture: 'captain_primary',
    evidence: ['availability-state', 'lineup-option', 'projection-result', 'team-brief'],
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    entryRoute: '/league-coordinator',
    accountFixture: 'league_coordinator',
    evidence: ['result-fixture', 'coordinator-source', 'public-league-page', 'privacy-check'],
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    entryRoute: '/pricing',
    accountFixture: 'full_court_operator',
    evidence: ['pricing-tier-copy', 'player-workspace', 'coach-workspace', 'league-workspace'],
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    entryRoute: '/admin/access',
    accountFixture: 'admin_test',
    evidence: ['test-profile', 'starting-access', 'target-access', 'import-review-status', 'affected-surface'],
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    entryRoute: '/explore',
    accountFixture: 'free_viewer',
    evidence: ['explore-route', 'public-detail-page', 'pricing-handoff', 'data-assist-review-language'],
  },
]

const journeyById = new Map(journeys.map((journey) => [journey.id, journey]))
const session = sessions.find((item) => item.aliases.includes(normalizedQuery))

console.log('TenAceIQ Customer Journey Evidence Pack')
console.log('')

if (!session) {
  console.log('Usage: npm run qa:evidence-pack -- <day1 | day2 | day3 | day4 | day5>')
  console.log('       npm run qa:evidence-pack -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>')
  console.log('')
  console.log('Available sessions:')
  for (const item of sessions) {
    console.log(`- ${item.id}: ${item.label} - ${item.focus}`)
  }
  process.exit(rawQuery ? 1 : 0)
}

const datePrefix = options.date || 'yyyy-mm-dd'
const deviceSlug = slugify(options.deviceBrowser || 'device')
const testerSlug = slugify(options.tester || 'tester')
const folder = `docs/qa-evidence/${datePrefix}/${session.id}`

console.log(`${session.label}: ${session.focus}`)
console.log(`Evidence folder: ${folder}`)
if (options.date || options.tester || options.deviceBrowser) {
  console.log(`Defaults: date=${options.date || 'blank'}, tester=${options.tester || 'blank'}, device/browser=${options.deviceBrowser || 'blank'}`)
}
console.log('')

console.log('Capture Names:')
for (const journeyId of session.journeyIds) {
  const journey = journeyById.get(journeyId)
  if (!journey) continue

  console.log(`- ${journey.label} (${journey.id})`)
  console.log(`  Route: ${journey.entryRoute}`)
  console.log(`  Fixture: ${journey.accountFixture}`)
  for (const evidenceName of journey.evidence) {
    console.log(`  - ${folder}/${datePrefix}-${session.id}-${journey.id}-${evidenceName}-${deviceSlug}-${testerSlug}.png`)
  }
}
console.log('')

console.log('Ledger Evidence Cells:')
for (const journeyId of session.journeyIds) {
  const journey = journeyById.get(journeyId)
  if (!journey) continue

  const evidenceCell = journey.evidence
    .map((evidenceName) => `${datePrefix}-${session.id}-${journey.id}-${evidenceName}-${deviceSlug}-${testerSlug}.png`)
    .join('; ')

  console.log(`- ${journey.id}: ${evidenceCell}`)
}
console.log('')

console.log('Use With:')
console.log(`- npm run qa:brief -- ${session.id}${formatDefaultsForCommand()}`)
console.log(`- npm run qa:day -- ${session.id}${formatDefaultsForCommand()}`)
console.log(`- npm run qa:close-day -- ${session.id}${options.date ? ` --date=${options.date}` : ''}`)
console.log('')
console.log('Closeout rule: evidence names should prove the journey signal, not just show that the route loaded.')

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

function formatDefaultsForCommand() {
  const parts = []
  if (options.date) parts.push(`--date=${options.date}`)
  if (options.tester) parts.push(`--tester=${options.tester}`)
  if (options.deviceBrowser) parts.push(`--device="${options.deviceBrowser}"`)

  return parts.length ? ` ${parts.join(' ')}` : ''
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
