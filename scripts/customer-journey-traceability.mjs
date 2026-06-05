import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const flowMapPath = 'lib/customer-journey-flow-map.json'
const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)

const tierLabels = {
  free: 'Free',
  player_plus: 'Player',
  coach: 'Coach',
  captain: 'Captain',
  league: 'League',
  full_court: 'Full-Court',
  admin_internal: 'Admin/Internal',
}

const tierAliases = {
  free: ['free', 'visitor', 'public'],
  player_plus: ['player', 'player-plus', 'playerplus', 'player+', 'player_plus'],
  coach: ['coach', 'coaches'],
  captain: ['captain', 'team-captain'],
  league: ['league', 'coordinator', 'league-coordinator'],
  full_court: ['full-court', 'fullcourt', 'full', 'all-access', 'full_court'],
  admin_internal: ['admin', 'internal', 'admin-internal', 'admin_internal'],
}

const provingJourneysByTier = {
  free: ['free-public-discovery'],
  player_plus: ['player-level-up-mobile-loop', 'player-my-lab-return-state'],
  coach: ['coach-player-assigned-challenge', 'coach-lesson-support'],
  captain: ['captain-week-flow'],
  league: ['league-result-to-public-context'],
  full_court: ['full-court-access-pass'],
  admin_internal: ['admin-access-and-data-quality'],
}

const flowMaps = JSON.parse(readFileSync(join(process.cwd(), flowMapPath), 'utf8'))
const ledgerRows = extractResultLedger(readFileSync(join(process.cwd(), resultsPath), 'utf8'))
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)

const selectedFlows = flowMaps.filter(matchesQuery)

console.log('TenAceIQ Journey Traceability Map')
console.log('')
console.log(`Sources: ${flowMapPath}; ${resultsPath}`)
console.log('Use this to connect tier promise, pain point, feature access, proving journeys, and ledger evidence.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!selectedFlows.length) {
  console.log(`No journey trace matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:trace -- <tier | journey | feature | route | search>')
  process.exit(1)
}

for (const flow of selectedFlows) {
  printFlowTrace(flow)
}

console.log('Use with:')
console.log('- npm run qa:today -- --date=yyyy-mm-dd --tester=<name>')
console.log('- npm run qa:coverage -- <tier>')
console.log('- npm run qa:feature-review -- <feature>')
console.log('- npm run qa:tier-status -- <tier>')
console.log('- npm run qa:scorecard')
console.log('')
console.log('Closeout rule: every tier promise needs a proving journey with pass evidence, no open p0/p1 row, and no broken handoff.')

function printFlowTrace(flow) {
  const provingJourneys = provingJourneysByTier[flow.tierId] ?? []
  const provingRows = provingJourneys.flatMap((journeyId) => ledgerRows.filter((row) => row.journeyId === journeyId))
  const passJourneyIds = new Set(provingRows.filter((row) => row.result === 'pass' && row.screenshotOrVideo).map((row) => row.journeyId))
  const openHighPriorityRows = provingRows.filter((row) => row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))
  const missingPassJourneyIds = provingJourneys.filter((journeyId) => !passJourneyIds.has(journeyId))
  const state = missingPassJourneyIds.length || openHighPriorityRows.length ? 'needs proof' : 'traceable'

  console.log(`${tierLabels[flow.tierId] ?? flow.tierId}: ${flow.label} - ${state}`)
  console.log(`  Persona: ${flow.persona}`)
  console.log(`  Pain point: ${flow.painPoint}`)
  console.log(`  Access rule: ${flow.accessRule}`)
  console.log(`  Entry: ${flow.entryRoute}`)
  console.log(`  Features: ${flow.primaryFeatureIds.join(', ')}`)
  console.log(`  Risk: ${flow.testRisk}`)
  console.log('  Proving journeys:')

  for (const journeyId of provingJourneys) {
    const journeyRows = ledgerRows.filter((row) => row.journeyId === journeyId)
    const latestRow = journeyRows.at(-1)
    const marker = passJourneyIds.has(journeyId) ? 'pass logged' : journeyRows.length ? 'needs retest' : 'missing result'

    console.log(`  - ${marker}: ${journeyId}`)
    console.log(`    Evidence: ${latestRow?.screenshotOrVideo || 'missing screenshot/video'}`)
    console.log(`    Command: npm run qa:journey -- ${journeyId}`)
  }

  console.log('  Key steps:')
  for (const step of flow.steps) {
    console.log(`  - ${step.stage}: ${step.action}`)
    console.log(`    Surface: ${step.surface}; route: ${step.route}`)
    console.log(`    Signal: ${step.productSignal}`)
  }

  if (flow.handoffs.length) {
    console.log('  Handoffs:')
    for (const handoff of flow.handoffs) {
      console.log(`  - to ${tierLabels[handoff.toTierId] ?? handoff.toTierId}: ${handoff.label}`)
      console.log(`    Trigger: ${handoff.trigger}`)
      console.log(`    Proof: ${handoff.proof}`)
    }
  }

  if (openHighPriorityRows.length) {
    console.log('  Open p0/p1 rows:')
    for (const row of openHighPriorityRows) {
      console.log(`  - ${row.severity} ${row.result}: ${row.journeyId}; ${row.category || 'uncategorized'}`)
      console.log(`    Next action: ${row.nextAction || 'missing next action'}`)
    }
  }

  if (missingPassJourneyIds.length) {
    console.log(`  Missing pass evidence: ${missingPassJourneyIds.join(', ')}`)
  }

  console.log('')
}

function matchesQuery(flow) {
  if (!rawQuery) return true

  const exactTierId = Object.entries(tierAliases).find(
    ([tierId, aliases]) => normalize(tierId) === normalizedQuery || aliases.map(normalize).includes(normalizedQuery),
  )?.[0]

  if (exactTierId) return flow.tierId === exactTierId

  const tierLabel = tierLabels[flow.tierId] ?? flow.tierId
  const haystack = [
    flow.id,
    flow.tierId,
    tierLabel,
    flow.label,
    flow.persona,
    flow.painPoint,
    flow.accessRule,
    flow.entryRoute,
    flow.testRisk,
    ...flow.primaryFeatureIds,
    ...(provingJourneysByTier[flow.tierId] ?? []),
    ...flow.steps.flatMap((step) => [step.stage, step.surface, step.route, step.action, step.productSignal, step.evidence]),
    ...flow.handoffs.flatMap((handoff) => [handoff.toTierId, handoff.label, handoff.trigger, handoff.proof]),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(rawQuery) || haystack.includes(normalizedQuery)
}

function parseMarkdownRow(line) {
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())

  return {
    journeyId: cells[4] ?? '',
    result: cells[6] ?? '',
    category: cells[7] ?? '',
    severity: cells[8] ?? '',
    screenshotOrVideo: cells[9] ?? '',
    nextAction: cells[11] ?? '',
  }
}

function extractResultLedger(markdown) {
  const startMarker = '## Result Ledger'
  const endMarker = '## Daily Summary'
  const startIndex = markdown.indexOf(startMarker)

  if (startIndex === -1) return ''

  const endIndex = markdown.indexOf(endMarker, startIndex + startMarker.length)
  return endIndex === -1 ? markdown.slice(startIndex) : markdown.slice(startIndex, endIndex)
}

function normalize(value) {
  return value.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
