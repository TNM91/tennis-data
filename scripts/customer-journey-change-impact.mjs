const args = parseArgs(process.argv.slice(2))
const changedFiles = getChangedFilesFromArgs()

const journeyPlans = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    session: 'day1',
    tier: 'Player',
    fixture: 'player_plus_linked',
    route: '/player-development/relentless-competitor-4-0/level-up',
    patterns: [
      'app/player-development/[identity]/level-up',
      'app/level-up',
      'components/level-up',
      'lib/level-up',
      'docs/level-up-sync-audit.md',
    ],
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    session: 'day1',
    tier: 'Coach',
    fixture: 'coach_primary',
    route: '/coach',
    patterns: [
      'app/coach',
      'app/api/coach',
      'app/api/player/coach-assignments',
      'app/api/player/level-up-sessions',
      'lib/coach',
      'lib/level-up',
    ],
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    session: 'day2',
    tier: 'Coach',
    fixture: 'coach_primary',
    route: '/player-development/relentless-competitor-4-0/coach-planner',
    patterns: ['app/player-development/[identity]/coach-planner', 'lib/player-development', 'lib/level-up'],
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    session: 'day2',
    tier: 'Player',
    fixture: 'player_plus_linked',
    route: '/mylab',
    patterns: ['app/mylab', 'app/profile', 'app/api/profile', 'lib/player', 'lib/product-story.ts'],
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    session: 'day3',
    tier: 'Captain',
    fixture: 'captain_primary',
    route: '/captain',
    patterns: ['app/captain', 'lib/captain', 'app/compete', 'lib/primary-nav-access.ts'],
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    session: 'day4',
    tier: 'League',
    fixture: 'league_coordinator',
    route: '/league-coordinator',
    patterns: ['app/league-coordinator', 'app/explore/leagues', 'app/leagues', 'app/api/leagues', 'lib/leagues'],
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    session: 'day5',
    tier: 'Full-Court',
    fixture: 'full_court_operator',
    route: '/pricing',
    patterns: ['app/pricing', 'app/upgrade', 'app/api/checkout', 'lib/pricing-plans.ts', 'lib/access-model.ts', 'lib/product-story.ts'],
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    session: 'day4',
    tier: 'Admin/Internal',
    fixture: 'admin_test',
    route: '/admin/access',
    patterns: ['app/admin', 'app/api/data-assist', 'app/api/import', 'lib/admin', 'supabase/migrations'],
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    session: 'day5',
    tier: 'Free',
    fixture: 'free_viewer',
    route: '/explore',
    patterns: ['app/explore', 'app/players', 'app/rankings', 'app/teams', 'lib/product-story.ts', 'lib/primary-nav-access.ts'],
  },
]

const sharedPatterns = [
  {
    label: 'Global app shell, navigation, access, or tier copy',
    patterns: ['app/layout.tsx', 'app/page.tsx', 'app/globals.css', 'components/site', 'lib/primary-nav-access.ts', 'lib/access-model.ts', 'lib/product-story.ts'],
    journeyIds: journeyPlans.map((plan) => plan.id),
  },
  {
    label: 'QA packet or documentation only',
    patterns: ['docs/', 'scripts/customer-journey', 'lib/__tests__/customer-journey'],
    journeyIds: [],
  },
]

const diffResult = {
  label: changedFiles.length ? 'provided changed files' : 'no changed files supplied',
  files: changedFiles,
}
const impacted = journeyPlans
  .map((plan) => ({
    plan,
    files: diffResult.files.filter((file) => matchesAny(file, plan.patterns) || matchesSharedJourney(file, plan.id)),
  }))
  .filter((item) => item.files.length)

const qaOnlyFiles = diffResult.files.filter((file) => matchesAny(file, sharedPatterns.find((item) => item.label === 'QA packet or documentation only')?.patterns ?? []))
const productFiles = diffResult.files.filter((file) => !qaOnlyFiles.includes(file))

console.log('TenAceIQ Change Impact Review')
console.log('')
console.log('Use this after a code change or deploy before trusting older pass evidence.')
console.log(`Diff source: ${diffResult.label}`)
console.log(`Changed files: ${diffResult.files.length}`)
console.log(`Product-affecting files: ${productFiles.length}`)
console.log('')

if (!diffResult.files.length) {
  console.log('No changed files supplied.')
  console.log('')
  console.log('Run `git diff --name-only <last-tested-sha-or-tag>..HEAD`, then pass the changed files with `npm run qa:change-impact -- --files=<comma-separated-files>`.')
  process.exit(0)
}

console.log('Changed files:')
for (const file of diffResult.files) console.log(`- ${file}`)
console.log('')

if (!impacted.length) {
  console.log('Impacted journeys:')
  console.log('- No direct product journey match from the current file map.')
  if (qaOnlyFiles.length) console.log('- QA packet or documentation changed; rerun qa:prep and trust journey evidence only after product files are unchanged or retested.')
  console.log('')
  console.log('Next commands:')
  console.log('- npm run qa:prep')
  console.log('- npm run qa:scorecard')
  console.log('- npm run qa:launch')
  process.exit(0)
}

console.log('Impacted journeys:')
for (const item of impacted) {
  const { plan, files } = item
  console.log(`- ${plan.id}: ${plan.label}`)
  console.log(`  Tier/session: ${plan.tier} / ${plan.session}`)
  console.log(`  Route: ${plan.route}`)
  console.log(`  Fixture: ${plan.fixture}`)
  console.log(`  Matched files: ${files.join(', ')}`)
  console.log(`  Rerun: npm run qa:tester-packet -- ${plan.session} --device=<phone|tablet|desktop>; npm run qa:retest -- ${plan.id}`)
}

const sessions = [...new Set(impacted.map((item) => item.plan.session))]

console.log('')
console.log('Session rerun queue:')
for (const session of sessions) {
  console.log(`- npm run qa:fixture-status -- ${session}`)
  console.log(`- npm run qa:tester-packet -- ${session} --device=<phone|tablet|desktop>`)
  console.log(`- npm run qa:tester-handoff -- ${session}`)
}

console.log('')
console.log('Next commands:')
console.log('- npm run qa:retest -- <day-or-journey>')
console.log('- npm run qa:evidence-pack -- <day1-day5>')
console.log('- npm run qa:scorecard')
console.log('- npm run qa:launch')
console.log('')
console.log('Change rule: after product files change, the affected journey needs fresh pass evidence before it is treated as signed off.')

function getChangedFilesFromArgs() {
  const filesFromFlag = (args.flags.files ?? '')
    .split(',')
    .map((file) => file.trim())
    .filter(Boolean)
  const filesFromPositionals = args.positionals.filter((arg) => arg.includes('/') || arg.includes('\\') || arg.includes('.'))

  return unique([...filesFromFlag, ...filesFromPositionals].map((file) => file.replaceAll('\\', '/')))
}

function matchesSharedJourney(file, journeyId) {
  return sharedPatterns.some((group) => group.journeyIds.includes(journeyId) && matchesAny(file, group.patterns))
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => file === pattern || file.startsWith(pattern) || file.includes(pattern))
}

function unique(values) {
  return [...new Set(values)]
}

function parseArgs(rawArgs) {
  const flags = {}
  const positionals = []

  for (const arg of rawArgs) {
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.slice(2).split('=')
      flags[key] = valueParts.join('=') || 'true'
    } else {
      positionals.push(arg)
    }
  }

  return { flags, positionals }
}
