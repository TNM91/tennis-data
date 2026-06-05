import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const queryAliases = {
  player: 'player_plus',
  playerplus: 'player_plus',
  'player+': 'player_plus',
  fullcourt: 'full_court',
  'full-court': 'full_court',
  admin: 'admin_internal',
  internal: 'admin_internal',
}
const query = queryAliases[rawQuery] ?? rawQuery
const flowMaps = JSON.parse(readFileSync(join(process.cwd(), 'lib/customer-journey-flow-map.json'), 'utf8'))

function matchesFlow(flow) {
  if (!query) return false

  const searchable = [
    flow.id,
    flow.tierId,
    flow.label,
    flow.persona,
    flow.painPoint,
    flow.entryRoute,
    ...flow.primaryFeatureIds,
  ]
    .join(' ')
    .toLowerCase()

  return searchable.includes(query)
}

function printFlow(flow) {
  console.log(`${flow.label} (${flow.id})`)
  console.log(`Tier: ${flow.tierId}`)
  console.log(`Entry: ${flow.entryRoute}`)
  console.log(`Risk: ${flow.testRisk}`)
  console.log(`Persona: ${flow.persona}`)
  console.log(`Pain point: ${flow.painPoint}`)
  console.log(`Access rule: ${flow.accessRule}`)
  console.log(`Features: ${flow.primaryFeatureIds.join(', ')}`)
  console.log('')
  console.log('Prove this path:')

  for (const [index, step] of flow.steps.entries()) {
    console.log(`${index + 1}. ${step.stage}: ${step.action}`)
    console.log(`   Surface: ${step.surface} (${step.route})`)
    console.log(`   Signal: ${step.productSignal}`)
    console.log(`   Evidence: ${step.evidence}`)
  }

  if (flow.handoffs.length) {
    console.log('')
    console.log('Handoff checks:')
    for (const handoff of flow.handoffs) {
      console.log(`- ${handoff.toTierId}: ${handoff.label}`)
      console.log(`  Trigger: ${handoff.trigger}`)
      console.log(`  Proof: ${handoff.proof}`)
    }
  }

  console.log('')
  console.log('Result rule: record the attempt in docs/customer-journey-test-results.md, then use qa:triage for any issue category or severity.')
}

console.log('TenAceIQ Focused Journey QA')
console.log('')

if (!query) {
  console.log('Usage: npm run qa:focus -- <tier | flow id | feature id | search>')
  console.log('')
  console.log('Examples:')
  console.log('- npm run qa:focus -- player_plus')
  console.log('- npm run qa:focus -- coach')
  console.log('- npm run qa:focus -- player-practice-progress-loop')
  console.log('- npm run qa:focus -- player-level-up')
  console.log('')
  console.log('Available flows:')
  for (const flow of flowMaps) {
    console.log(`- ${flow.id} (${flow.tierId})`)
  }
  process.exit(0)
}

const exactMatches = query
  ? flowMaps.filter((flow) => flow.id.toLowerCase() === query || flow.tierId.toLowerCase() === query)
  : []
const matches = exactMatches.length ? exactMatches : flowMaps.filter(matchesFlow)

if (!matches.length) {
  console.error(`No focused journey flow matched "${query}".`)
  console.error('Run `npm run qa:focus` with no argument to list available flows.')
  process.exit(1)
}

console.log(`Matched ${matches.length} flow${matches.length === 1 ? '' : 's'} for "${query}".`)
console.log('')

for (const [index, flow] of matches.entries()) {
  if (index > 0) {
    console.log('---')
    console.log('')
  }

  printFlow(flow)
}
