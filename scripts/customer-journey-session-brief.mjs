import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { customerJourneySessions, normalizeQaQuery } from './customer-journey-qa-data.mjs'

const rawQuery = process.argv[2]?.trim().toLowerCase() ?? ''
const normalizedQuery = normalizeQaQuery(rawQuery)
const flowMaps = JSON.parse(readFileSync(join(process.cwd(), 'lib/customer-journey-flow-map.json'), 'utf8'))

const session = customerJourneySessions.find((item) => item.aliases.includes(normalizedQuery))

console.log('TenAceIQ Customer Journey Session Brief')
console.log('')

if (!session) {
  console.log('Usage: npm run qa:session -- <day1|day2|day3|day4|day5>')
  console.log('')
  console.log('Available sessions:')
  for (const item of customerJourneySessions) {
    console.log(`- ${item.id}: ${item.shortLabel} - ${item.focus}`)
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

console.log(`${session.shortLabel}: ${session.focus}`)
console.log(`Question: ${session.closeoutQuestion}`)
console.log('')
console.log('Journeys:')
for (const journeyId of session.journeyIds) {
  console.log(`- ${journeyId}`)
}

console.log('')
console.log('Fixtures:')
for (const fixture of session.fixtureIds) {
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
