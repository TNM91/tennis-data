import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const flowMaps = JSON.parse(readFileSync(join(process.cwd(), 'lib/customer-journey-flow-map.json'), 'utf8'))
const handoffs = flowMaps.flatMap((flow) =>
  flow.handoffs.map((handoff) => ({
    fromFlowId: flow.id,
    fromTierId: flow.tierId,
    fromLabel: flow.label,
    fromEntry: flow.entryRoute,
    risk: flow.testRisk,
    ...handoff,
  })),
)

console.log('TenAceIQ Customer Journey Handoff Map')
console.log('')
console.log('Use this to verify the platform interconnections by tier, role, and shared proof.')
console.log('Source: lib/customer-journey-flow-map.json')
console.log('')

for (const handoff of handoffs) {
  console.log(`${handoff.fromTierId} -> ${handoff.toTierId}: ${handoff.label}`)
  console.log(`  Source journey: ${handoff.fromLabel} (${handoff.fromFlowId})`)
  console.log(`  Entry: ${handoff.fromEntry}`)
  console.log(`  Risk: ${handoff.risk}`)
  console.log(`  Trigger: ${handoff.trigger}`)
  console.log(`  Proof to capture: ${handoff.proof}`)
  console.log('')
}

console.log(`Handoffs to verify: ${handoffs.length}`)
console.log('Closeout rule: shared work must reach the right role, avoid the wrong role, and stay honest about local vs synced state.')
