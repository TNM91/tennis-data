import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const processMapPath = 'docs/customer-journey-process-map.md'
const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)

const tiers = [
  {
    id: 'free',
    aliases: ['free', 'visitor', 'public'],
    label: 'Free',
    fixture: 'free_viewer',
    promise: 'Useful public tennis intelligence before upgrade pressure.',
    journeys: ['free-public-discovery'],
    day: 'day5',
    failFast: ['upgrade prompt before useful context', 'private workspace controls visible', 'Data Assist implies instant trusted data'],
  },
  {
    id: 'player_plus',
    aliases: ['player', 'player-plus', 'playerplus', 'player_plus'],
    label: 'Player',
    fixture: 'player_plus_linked',
    promise: 'Turn lessons, goals, and practice into visible progress.',
    journeys: ['player-level-up-mobile-loop', 'player-my-lab-return-state'],
    day: 'day1/day2',
    failFast: ['too much scroll before action', 'generic drill copy', 'local proof presented as synced', 'generic empty dashboard'],
  },
  {
    id: 'coach',
    aliases: ['coach', 'coaches'],
    label: 'Coach',
    fixture: 'coach_primary',
    promise: 'Keep coach and player aligned between lessons.',
    journeys: ['coach-player-assigned-challenge', 'coach-lesson-support'],
    day: 'day1/day2',
    failFast: ['assignment visible to wrong player', 'coach cannot find proof', 'lesson plan disconnected from Level Up'],
  },
  {
    id: 'captain',
    aliases: ['captain', 'team-captain'],
    label: 'Captain',
    fixture: 'captain_primary',
    promise: 'Move from availability and context to lineup choices and team communication.',
    journeys: ['captain-week-flow'],
    day: 'day3',
    failFast: ['availability disconnected from lineup', 'projection unclear', 'message or brief dead end'],
  },
  {
    id: 'league',
    aliases: ['league', 'coordinator', 'league-coordinator'],
    label: 'League',
    fixture: 'league_coordinator',
    promise: 'Run league structure, schedules, results, standings, and visibility from one workspace.',
    journeys: ['league-result-to-public-context'],
    day: 'day4',
    failFast: ['result does not propagate', 'private controls visible publicly', 'standings context missing'],
  },
  {
    id: 'full_court',
    aliases: ['full-court', 'fullcourt', 'full_court', 'all-access'],
    label: 'Full-Court',
    fixture: 'full_court_operator',
    promise: 'Clean access to every paid workspace without tier confusion.',
    journeys: ['full-court-access-pass'],
    day: 'day5',
    failFast: ['paid workspace locked', 'redundant upgrade prompt', 'role navigation confusing'],
  },
  {
    id: 'admin_internal',
    aliases: ['admin', 'internal', 'admin-internal', 'admin_internal'],
    label: 'Admin/Internal',
    fixture: 'admin_test',
    promise: 'Protect access and tennis data quality with fixture-safe internal workflows.',
    journeys: ['admin-access-and-data-quality'],
    day: 'day4',
    failFast: ['test data not isolated', 'access change not reflected', 'unreviewed data treated as trusted'],
  },
]

const processMapSource = readFileSync(join(process.cwd(), processMapPath), 'utf8')
const featureRows = parseFeatureMatrix(processMapSource)
const resultRows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)

const selectedTiers = getSelectedTiers()

console.log('TenAceIQ Tier Feature Board')
console.log('')
console.log(`Sources: ${processMapPath}; ${resultsPath}`)
console.log('Use this when testing by tier: promise, fixture, features, pain points, proving journeys, evidence state, and next command.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!selectedTiers.length) {
  console.log(`No tier matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:tier-board -- <free | player | coach | captain | league | full-court | admin | feature | journey | route>')
  process.exit(1)
}

for (const tier of selectedTiers) printTierBoard(tier)

console.log('Use with:')
console.log('- npm run qa:tier -- <tier>')
console.log('- npm run qa:tier-status -- <tier>')
console.log('- npm run qa:access-review -- <tier>')
console.log('- npm run qa:feature-review -- <feature>')
console.log('- npm run qa:coverage -- <tier>')
console.log('- npm run qa:owner-board -- <tier>')
console.log('')
console.log('Board rule: each tier is test-ready only when the feature pain points are proved by journey evidence, protected controls behave correctly, and no p0/p1 row remains open.')

function printTierBoard(tier) {
  const features = featureRows.filter((row) => row.tier === tier.label)
  const rows = resultRows.filter((row) => tier.journeys.includes(row.journeyId))
  const passRows = rows.filter((row) => row.result === 'pass')
  const passJourneyIds = new Set(passRows.map((row) => row.journeyId))
  const passEvidenceJourneyIds = new Set(passRows.filter((row) => row.screenshotOrVideo).map((row) => row.journeyId))
  const testedJourneyIds = new Set(rows.map((row) => row.journeyId))
  const openHighPriorityRows = rows.filter((row) => (row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass')
  const missingPassJourneyIds = tier.journeys.filter((journeyId) => !passJourneyIds.has(journeyId))
  const missingEvidenceJourneyIds = tier.journeys.filter((journeyId) => passJourneyIds.has(journeyId) && !passEvidenceJourneyIds.has(journeyId))
  const state = getTierState({ openHighPriorityRows, missingPassJourneyIds, missingEvidenceJourneyIds })

  console.log(`${tier.label}: ${state}`)
  console.log(`  Promise: ${tier.promise}`)
  console.log(`  Fixture: ${tier.fixture}; testing day: ${tier.day}`)
  console.log(`  Features: ${features.length}; journeys: ${tier.journeys.length}; ledger rows: ${rows.length}`)
  console.log(`  Pass journeys: ${passJourneyIds.size}/${tier.journeys.length}; pass with evidence: ${passEvidenceJourneyIds.size}/${tier.journeys.length}; open p0/p1: ${openHighPriorityRows.length}`)
  console.log('')
  console.log('  Feature pain points:')
  for (const feature of features) {
    console.log(`  - ${feature.feature} (${feature.stage})`)
    console.log(`    Route: ${feature.route}; status: ${feature.status}; verification: ${feature.verification}`)
    console.log(`    Pain point: ${feature.painPoint}`)
  }
  console.log('')
  console.log('  Proving journeys:')
  for (const journeyId of tier.journeys) {
    const marker = passEvidenceJourneyIds.has(journeyId)
      ? 'pass evidence'
      : passJourneyIds.has(journeyId)
        ? 'pass missing evidence'
        : testedJourneyIds.has(journeyId)
          ? 'needs review'
          : 'missing'
    console.log(`  - ${marker}: ${journeyId}`)
  }
  console.log('')
  console.log('  Fail fast if:')
  for (const blocker of tier.failFast) console.log(`  - ${blocker}`)

  if (openHighPriorityRows.length) {
    console.log('')
    console.log('  Blocking rows:')
    for (const row of openHighPriorityRows) {
      console.log(`  - ${row.severity} ${row.result}: ${row.journeyId}; ${row.category || 'uncategorized'}; ${row.nextAction || 'missing next action'}`)
    }
  }

  console.log(`  Next: ${getNextCommand({ tier, openHighPriorityRows, missingPassJourneyIds, missingEvidenceJourneyIds })}`)
  console.log('')
}

function getTierState({ openHighPriorityRows, missingPassJourneyIds, missingEvidenceJourneyIds }) {
  if (openHighPriorityRows.length) return 'blocked'
  if (missingPassJourneyIds.length) return 'needs pass'
  if (missingEvidenceJourneyIds.length) return 'needs evidence'
  return 'ready'
}

function getNextCommand({ tier, openHighPriorityRows, missingPassJourneyIds, missingEvidenceJourneyIds }) {
  if (openHighPriorityRows.length) return `npm run qa:action-list ${tier.journeys[0]}`
  if (missingPassJourneyIds.length) return `npm run qa:journey -- ${missingPassJourneyIds[0]}`
  if (missingEvidenceJourneyIds.length) return `npm run qa:evidence-pack -- ${tier.day.split('/')[0]}`
  return `npm run qa:coverage -- ${tier.aliases[0]}`
}

function parseFeatureMatrix(source) {
  const matrixStart = source.indexOf('## Feature Access And Pain Point Matrix')
  const matrixEnd = source.indexOf('## Next Week Test Order')

  if (matrixStart === -1 || matrixEnd === -1 || matrixEnd <= matrixStart) {
    console.error(`Could not find the feature matrix in ${processMapPath}.`)
    process.exit(1)
  }

  return source
    .slice(matrixStart, matrixEnd)
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.includes('---'))
    .slice(1)
    .map((line) => {
      const [tier, feature, stage, route, painPoint, status, verification] = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim().replaceAll('`', ''))

      return { tier, feature, stage, route, painPoint, status, verification }
    })
}

function matchesQuery(tier) {
  if (!rawQuery) return true

  const features = featureRows.filter((row) => row.tier === tier.label)
  const haystack = [
    tier.id,
    ...tier.aliases,
    tier.label,
    tier.fixture,
    tier.promise,
    tier.day,
    ...tier.journeys,
    ...tier.failFast,
    ...features.flatMap((feature) => [feature.feature, feature.stage, feature.route, feature.painPoint, feature.status, feature.verification]),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(rawQuery) || tier.aliases.some((alias) => normalize(alias) === normalizedQuery) || normalize(tier.id) === normalizedQuery
}

function getSelectedTiers() {
  if (!rawQuery) return tiers

  const exactTier = tiers.find((tier) => tier.aliases.some((alias) => normalize(alias) === normalizedQuery) || normalize(tier.id) === normalizedQuery)

  return exactTier ? [exactTier] : tiers.filter(matchesQuery)
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
  return value.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
