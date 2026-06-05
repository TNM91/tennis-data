import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const processMapPath = 'docs/customer-journey-process-map.md'
const flowMapPath = 'lib/customer-journey-flow-map.json'
const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)

const journeyPlans = [
  {
    id: 'player-level-up-mobile-loop',
    tier: 'Player',
    route: '/player-development/relentless-competitor-4-0/level-up',
    fixture: 'player_plus_linked',
    passSignal: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
  },
  {
    id: 'coach-player-assigned-challenge',
    tier: 'Coach',
    route: '/coach',
    fixture: 'coach_primary',
    passSignal: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
  },
  {
    id: 'coach-lesson-support',
    tier: 'Coach',
    route: '/player-development/relentless-competitor-4-0/coach-planner',
    fixture: 'coach_primary',
    passSignal: 'The planner is coach-facing, practical, and connected to the player Level Up path.',
  },
  {
    id: 'player-my-lab-return-state',
    tier: 'Player',
    route: '/mylab',
    fixture: 'player_plus_linked',
    passSignal: 'My Lab makes the player identity, linked profile, and next action clear after refresh.',
  },
  {
    id: 'captain-week-flow',
    tier: 'Captain',
    route: '/captain',
    fixture: 'captain_primary',
    passSignal: 'Captain can make a weekly decision and produce a useful team-facing update.',
  },
  {
    id: 'league-result-to-public-context',
    tier: 'League',
    route: '/league-coordinator',
    fixture: 'league_coordinator',
    passSignal: 'Coordinator operation and member-facing league context stay connected without exposing private controls.',
  },
  {
    id: 'full-court-access-pass',
    tier: 'Full-Court',
    route: '/pricing',
    fixture: 'full_court_operator',
    passSignal: 'All paid workspaces open cleanly and the user can tell which workspace fits the job.',
  },
  {
    id: 'admin-access-and-data-quality',
    tier: 'Admin/Internal',
    route: '/admin/access',
    fixture: 'admin_test',
    passSignal: 'Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces.',
  },
  {
    id: 'free-public-discovery',
    tier: 'Free',
    route: '/explore',
    fixture: 'free_viewer',
    passSignal: 'Public tennis intelligence is visible first, and upgrade/data-assist paths are clear.',
  },
]

const processMapSource = readFileSync(join(process.cwd(), processMapPath), 'utf8')
const flowMaps = JSON.parse(readFileSync(join(process.cwd(), flowMapPath), 'utf8'))
const ledgerRows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)

const routeReviews = buildRouteReviews().filter(matchesQuery)

console.log('TenAceIQ Route Review')
console.log('')
console.log(`Sources: ${processMapPath}; ${flowMapPath}; ${resultsPath}`)
console.log('Use this while you are on a route in the browser and need to know which tier, feature, journey, fixture, and evidence that page is supposed to prove.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!routeReviews.length) {
  console.log(`No route matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:route-review -- </route | tier | feature | journey | search>')
  process.exit(1)
}

for (const routeReview of routeReviews) {
  printRoute(routeReview)
}

console.log('Use with:')
console.log('- npm run qa:journey -- <journey-id>')
console.log('- npm run qa:feature-review -- <feature>')
console.log('- npm run qa:access-review -- <tier>')
console.log('- npm run qa:evidence-pack -- <day1-day5>')
console.log('')
console.log('Closeout rule: a route is not proven by loading. It is proven when the linked journey has pass evidence and the page solves the documented pain point without access or handoff drift.')

function buildRouteReviews() {
  const features = readFeatureMatrix()
  const routeMap = new Map()

  for (const feature of features) {
    const review = ensureRoute(routeMap, feature.route)
    review.features.push(feature)
    review.tiers.add(feature.tier)
  }

  for (const journey of journeyPlans) {
    const review = ensureRoute(routeMap, journey.route)
    review.journeys.push(journey)
    review.tiers.add(journey.tier)
  }

  for (const flow of flowMaps) {
    const review = ensureRoute(routeMap, flow.entryRoute)
    review.flows.push({
      id: flow.id,
      label: flow.label,
      tierId: flow.tierId,
      stage: 'entry',
      surface: 'Entry',
      action: flow.painPoint,
      signal: flow.accessRule,
    })

    for (const step of flow.steps) {
      const stepReview = ensureRoute(routeMap, step.route)
      stepReview.flows.push({
        id: flow.id,
        label: flow.label,
        tierId: flow.tierId,
        stage: step.stage,
        surface: step.surface,
        action: step.action,
        signal: step.productSignal,
      })
    }
  }

  return [...routeMap.values()].sort((a, b) => a.route.localeCompare(b.route))
}

function ensureRoute(routeMap, route) {
  if (!routeMap.has(route)) {
    routeMap.set(route, {
      route,
      tiers: new Set(),
      features: [],
      journeys: [],
      flows: [],
    })
  }

  return routeMap.get(route)
}

function printRoute(routeReview) {
  const linkedJourneyIds = [...new Set(routeReview.journeys.map((journey) => journey.id))]
  const passRows = linkedJourneyIds.flatMap((journeyId) =>
    ledgerRows.filter((row) => row.journeyId === journeyId && row.result === 'pass' && row.screenshotOrVideo),
  )
  const blockers = linkedJourneyIds.flatMap((journeyId) =>
    ledgerRows.filter((row) => row.journeyId === journeyId && row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1')),
  )
  const evidenceState = passRows.length && !blockers.length ? 'has pass evidence' : linkedJourneyIds.length ? 'needs journey evidence' : 'reference route'

  console.log(`${routeReview.route} - ${evidenceState}`)
  console.log(`  Tiers: ${[...routeReview.tiers].join(', ') || 'none listed'}`)

  if (routeReview.features.length) {
    console.log('  Features:')
    for (const feature of routeReview.features) {
      console.log(`  - ${feature.label} (${feature.stage})`)
      console.log(`    Tier: ${feature.tier}; status: ${feature.status}; verification: ${feature.verification}`)
      console.log(`    Pain point: ${feature.painPoint}`)
    }
  }

  if (routeReview.journeys.length) {
    console.log('  Proving journeys:')
    for (const journey of routeReview.journeys) {
      const journeyRows = ledgerRows.filter((row) => row.journeyId === journey.id)
      const latestRow = journeyRows.at(-1)
      const marker = journeyRows.some((row) => row.result === 'pass' && row.screenshotOrVideo)
        ? 'pass logged'
        : journeyRows.length
          ? 'needs retest'
          : 'missing result'

      console.log(`  - ${marker}: ${journey.id}`)
      console.log(`    Fixture: ${journey.fixture}`)
      console.log(`    Pass: ${journey.passSignal}`)
      console.log(`    Evidence: ${latestRow?.screenshotOrVideo || 'missing screenshot/video'}`)
      console.log(`    Command: npm run qa:journey -- ${journey.id}`)
    }
  }

  if (routeReview.flows.length) {
    console.log('  Flow signals:')
    for (const flow of routeReview.flows.slice(0, 4)) {
      console.log(`  - ${flow.label} (${flow.stage}; ${flow.surface})`)
      console.log(`    Action: ${flow.action}`)
      console.log(`    Signal: ${flow.signal}`)
    }

    if (routeReview.flows.length > 4) {
      console.log(`  - ${routeReview.flows.length - 4} more flow signal(s) hidden; use qa:focus for the full path.`)
    }
  }

  if (blockers.length) {
    console.log('  Open p0/p1:')
    for (const blocker of blockers) {
      console.log(`  - ${blocker.severity} ${blocker.result}: ${blocker.category || 'uncategorized'}; ${blocker.nextAction || 'missing next action'}`)
    }
  }

  console.log(`  Next: ${routeReview.journeys[0] ? `npm run qa:journey -- ${routeReview.journeys[0].id}` : 'npm run qa:flows'}`)
  console.log('')
}

function matchesQuery(routeReview) {
  if (!rawQuery) return true
  if (rawQuery.startsWith('/')) return routeReview.route === rawQuery || routeReview.route.startsWith(`${rawQuery}/`)

  const haystack = [
    routeReview.route,
    ...routeReview.tiers,
    ...routeReview.features.flatMap((feature) => [feature.label, feature.stage, feature.painPoint, feature.status, feature.verification]),
    ...routeReview.journeys.flatMap((journey) => [journey.id, journey.fixture, journey.passSignal]),
    ...routeReview.flows.flatMap((flow) => [flow.id, flow.label, flow.tierId, flow.stage, flow.surface, flow.action, flow.signal]),
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
  return value.replace(/[^a-z0-9/[\]-]+/g, '-').replace(/^-|-$/g, '')
}
