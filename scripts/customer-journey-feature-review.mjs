import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const processMapPath = 'docs/customer-journey-process-map.md'
const flowMapPath = 'lib/customer-journey-flow-map.json'
const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)

const featureContracts = [
  {
    id: 'free-public-explore',
    label: 'Public Explore',
    provingJourneys: ['free-public-discovery'],
    fixture: 'free_viewer',
  },
  {
    id: 'free-data-assist-entry',
    label: 'Data Assist Entry',
    provingJourneys: ['free-public-discovery', 'admin-access-and-data-quality'],
    fixture: 'free_viewer',
  },
  {
    id: 'player-my-lab',
    label: 'My Lab',
    provingJourneys: ['player-my-lab-return-state'],
    fixture: 'player_plus_linked',
  },
  {
    id: 'player-level-up',
    label: 'Level Up Portal',
    provingJourneys: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
    fixture: 'player_plus_linked',
  },
  {
    id: 'player-level-up-content',
    label: 'Level Up Content Library',
    provingJourneys: ['player-level-up-mobile-loop', 'coach-lesson-support'],
    fixture: 'player_plus_linked',
  },
  {
    id: 'coach-hub',
    label: 'Coach Hub',
    provingJourneys: ['coach-player-assigned-challenge'],
    fixture: 'coach_primary',
  },
  {
    id: 'coach-invite-link',
    label: 'Coach Invite Link',
    provingJourneys: ['coach-player-assigned-challenge'],
    fixture: 'coach_primary',
  },
  {
    id: 'coach-lesson-planner',
    label: 'Coach Lesson Planner',
    provingJourneys: ['coach-lesson-support'],
    fixture: 'coach_primary',
  },
  {
    id: 'captain-lineup-week',
    label: 'Captain Lineup Week',
    provingJourneys: ['captain-week-flow'],
    fixture: 'captain_primary',
  },
  {
    id: 'captain-compete-bridge',
    label: 'Compete Bridge',
    provingJourneys: ['captain-week-flow'],
    fixture: 'captain_primary',
  },
  {
    id: 'league-office',
    label: 'League Office',
    provingJourneys: ['league-result-to-public-context'],
    fixture: 'league_coordinator',
  },
  {
    id: 'league-public-context',
    label: 'Public League Context',
    provingJourneys: ['league-result-to-public-context'],
    fixture: 'league_coordinator',
  },
  {
    id: 'full-court-navigation',
    label: 'Full-Court Navigation',
    provingJourneys: ['full-court-access-pass'],
    fixture: 'full_court_operator',
  },
  {
    id: 'admin-access-management',
    label: 'Admin Access Management',
    provingJourneys: ['admin-access-and-data-quality'],
    fixture: 'admin_test',
  },
  {
    id: 'admin-data-quality',
    label: 'Admin Data Quality',
    provingJourneys: ['admin-access-and-data-quality'],
    fixture: 'admin_test',
  },
]

const processMapSource = readFileSync(join(process.cwd(), processMapPath), 'utf8')
const flowMaps = JSON.parse(readFileSync(join(process.cwd(), flowMapPath), 'utf8'))
const ledgerRows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)

const features = readFeatureMatrix().map(attachContract).filter(matchesQuery)

console.log('TenAceIQ Feature Review')
console.log('')
console.log(`Sources: ${processMapPath}; ${flowMapPath}; ${resultsPath}`)
console.log('Use this when you are testing one feature and need the tier, route, pain point, proving journey, flow handoff, and evidence state in one place.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!features.length) {
  console.log(`No feature matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:feature-review -- <feature id | feature label | tier | route | search>')
  process.exit(1)
}

for (const feature of features) {
  printFeature(feature)
}

console.log('Use with:')
console.log('- npm run qa:coverage -- <tier>')
console.log('- npm run qa:access-review -- <tier>')
console.log('- npm run qa:journey -- <journey-id>')
console.log('- npm run qa:scorecard')
console.log('')
console.log('Closeout rule: a feature is not ready until the proving journey has pass evidence, the pain point is solved, and related handoffs do not leak to the wrong tier.')

function printFeature(feature) {
  const provingFlows = flowMaps.filter((flow) => flow.primaryFeatureIds.includes(feature.id))
  const provingRows = feature.provingJourneys.flatMap((journeyId) => ledgerRows.filter((row) => row.journeyId === journeyId))
  const passRows = provingRows.filter((row) => row.result === 'pass' && row.screenshotOrVideo)
  const blockers = provingRows.filter((row) => row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))
  const evidenceState = passRows.length && !blockers.length ? 'has pass evidence' : provingRows.length ? 'needs retest or evidence' : 'missing result'

  console.log(`${feature.label} (${feature.id}) - ${evidenceState}`)
  console.log(`  Tier: ${feature.tier}`)
  console.log(`  Stage: ${feature.stage}`)
  console.log(`  Route: ${feature.route}`)
  console.log(`  Status: ${feature.status}; verification: ${feature.verification}`)
  console.log(`  Fixture: ${feature.fixture}`)
  console.log(`  Pain point: ${feature.painPoint}`)
  console.log('  Proving journeys:')

  for (const journeyId of feature.provingJourneys) {
    const journeyRows = ledgerRows.filter((row) => row.journeyId === journeyId)
    const latestRow = journeyRows.at(-1)
    const marker = journeyRows.some((row) => row.result === 'pass' && row.screenshotOrVideo)
      ? 'pass logged'
      : journeyRows.length
        ? 'needs retest'
        : 'missing result'

    console.log(`  - ${marker}: ${journeyId}`)
    console.log(`    Latest evidence: ${latestRow?.screenshotOrVideo || 'missing screenshot/video'}`)
    console.log(`    Command: npm run qa:journey -- ${journeyId}`)
  }

  console.log('  Connected flows:')
  for (const flow of provingFlows) {
    console.log(`  - ${flow.label} (${flow.id})`)
    console.log(`    Entry: ${flow.entryRoute}`)
    console.log(`    Access: ${flow.accessRule}`)
    console.log(`    Handoffs: ${flow.handoffs.map((handoff) => handoff.toTierId).join(', ') || 'none'}`)
  }

  if (blockers.length) {
    console.log('  Open p0/p1:')
    for (const blocker of blockers) {
      console.log(`  - ${blocker.severity} ${blocker.result}: ${blocker.category || 'uncategorized'}; ${blocker.nextAction || 'missing next action'}`)
    }
  }

  console.log(`  Next: npm run qa:coverage -- ${feature.tier.toLowerCase().replaceAll('/', '-')}`)
  console.log('')
}

function attachContract(feature) {
  const contract = featureContracts.find((item) => item.label === feature.label)

  if (!contract) {
    return {
      ...feature,
      id: normalize(feature.label),
      provingJourneys: [],
      fixture: 'missing fixture',
    }
  }

  return {
    ...feature,
    ...contract,
  }
}

function matchesQuery(feature) {
  if (!rawQuery) return true

  const haystack = [
    feature.id,
    feature.label,
    feature.tier,
    feature.stage,
    feature.route,
    feature.painPoint,
    feature.status,
    feature.verification,
    ...feature.provingJourneys,
    feature.fixture,
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(rawQuery) || haystack.includes(normalizedQuery)
}

function readFeatureMatrix() {
  const matrixStart = processMapSource.indexOf('## Feature Access And Pain Point Matrix')
  const matrixEnd = processMapSource.indexOf('## Next Week Test Order')

  if (matrixStart === -1 || matrixEnd === -1 || matrixEnd <= matrixStart) {
    console.error(`Could not find the feature matrix in ${processMapPath}.`)
    process.exit(1)
  }

  return processMapSource
    .slice(matrixStart, matrixEnd)
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.includes('---'))
    .slice(1)
    .map(parseMatrixRow)
}

function parseMatrixRow(line) {
  const [tier, label, stage, route, painPoint, status, verification] = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim().replaceAll('`', ''))

  return {
    tier,
    label,
    stage,
    route,
    painPoint,
    status,
    verification,
  }
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
