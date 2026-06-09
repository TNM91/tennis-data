import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, normalizeQaQuery, tierAliases } from './customer-journey-qa-data.mjs'

const processMapPath = 'docs/customer-journey-process-map.md'
const flowMapPath = 'lib/customer-journey-flow-map.json'

const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalizeQaQuery(rawQuery)
const processMapSource = readFileSync(join(process.cwd(), processMapPath), 'utf8')
const flowMaps = JSON.parse(readFileSync(join(process.cwd(), flowMapPath), 'utf8'))

const matrixRows = readFeatureMatrix()
const tierOrder = ['free', 'player_plus', 'coach', 'captain', 'league', 'full_court', 'admin_internal']
const denyChecksByTier = {
  free: [
    'Private workspace controls stay hidden.',
    'Upgrade copy appears after useful public context.',
    'Data Assist does not imply instant trusted data.',
  ],
  player_plus: [
    'Coach review tools stay out of player mode.',
    'Captain, league, and admin controls stay hidden.',
    'Local proof is not described as synced unless the account is linked.',
  ],
  coach: [
    'Coach sees only linked students or safe fixtures.',
    'Player proof is reviewable without account takeover.',
    'Captain, league, and admin controls stay hidden.',
  ],
  captain: [
    'Coach assignment tools stay hidden.',
    'League office and admin controls stay hidden.',
    'Team communication does not expose private player-only data.',
  ],
  league: [
    'Private coordinator controls do not appear on public league pages.',
    'Captain lineup controls stay outside league operations.',
    'Fixture data is clearly safe test data.',
  ],
  full_court: [
    'No paid workspace shows stale locks.',
    'Role switching is understandable.',
    'Upgrade prompts do not repeat inside included workspaces.',
  ],
  admin_internal: [
    'Only safe fixtures are touched during test week.',
    'Unreviewed imports do not become trusted public context.',
    'Access repair leaves an audit-ready before/after signal.',
  ],
}
const tierChecks = tierOrder.map(buildTierCheck).filter((tier) => tier.provingJourneys.length)

const selectedTiers = selectTiers()

console.log('TenAceIQ Tier Access Review')
console.log('')
console.log(`Sources: ${processMapPath}; ${flowMapPath}`)
console.log('Use this while testing each tier to confirm the right tools unlock, wrong controls stay hidden, and evidence ties back to the journey ledger.')
console.log('Treat wrong unlocks as access-gap or gating-gap until fixture setup proves otherwise; protected-control mistakes are p0/p1 candidates.')
console.log('')

if (!selectedTiers.length) {
  console.log(`No tier matched "${rawQuery}".`)
  console.log('')
  printUsage()
  process.exit(1)
}

for (const tier of selectedTiers) {
  printTier(tier)
}

console.log('Use with:')
console.log('- npm run qa:tier -- <tier>')
console.log('- npm run qa:tier-status -- <tier>')
console.log('- npm run qa:scorecard')
console.log('- npm run qa:launch')
console.log('')
console.log('Closeout rule: access is not ready until the expected tier can use its tools, lower tiers cannot see protected controls, and the proving journey has ledger evidence.')

function selectTiers() {
  if (!rawQuery) return tierChecks

  const tierLabel = tierAliases.get(normalizedQuery)

  return tierChecks.filter((tier) => tier.aliases.includes(normalizedQuery) || tier.label === tierLabel)
}

function buildTierCheck(id) {
  const journeys = customerJourneyDetails.filter((journey) => journey.tierId === id)
  const label = journeys[0]?.tier ?? id
  const aliases = new Set([normalizeQaQuery(id), normalizeQaQuery(label)])

  for (const [alias, aliasLabel] of tierAliases) {
    if (aliasLabel === label) aliases.add(alias)
  }

  return {
    id,
    aliases: [...aliases],
    label,
    provingJourneys: journeys.map((journey) => journey.id),
    fixture: journeys[0]?.accountFixture ?? 'missing fixture',
    denyChecks: denyChecksByTier[id] ?? [],
  }
}

function printUsage() {
  console.log('Usage: npm run qa:access-review -- <free | player | coach | captain | league | full-court | admin>')
}

function printTier(tier) {
  const flow = flowMaps.find((item) => item.tierId === tier.id)
  const features = matrixRows.filter((row) => row.tier === tier.label)

  console.log(`${tier.label} Access Review (${tier.id})`)
  console.log(`  Fixture: ${tier.fixture}`)
  console.log(`  Entry: ${flow?.entryRoute ?? 'missing flow entry'}`)
  console.log(`  Access rule: ${flow?.accessRule ?? 'missing access rule'}`)
  console.log(`  Proving journeys: ${tier.provingJourneys.join(', ')}`)
  console.log('  Expected tools:')

  for (const feature of features) {
    console.log(`  - ${feature.feature} (${feature.stage})`)
    console.log(`    Route: ${feature.route}`)
    console.log(`    Status: ${feature.status}; verification: ${feature.verification}`)
    console.log(`    Pain point: ${feature.painPoint}`)
  }

  console.log('  Must not happen:')
  for (const check of tier.denyChecks) console.log(`  - ${check}`)
  console.log(`  Next: npm run qa:tier -- ${tier.aliases[0]}`)
  console.log('')
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
  const [tier, feature, stage, route, painPoint, status, verification] = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim().replaceAll('`', ''))

  return {
    tier,
    feature,
    stage,
    route,
    painPoint,
    status,
    verification,
  }
}
