import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const flowMaps = JSON.parse(readFileSync(join(process.cwd(), 'lib/customer-journey-flow-map.json'), 'utf8'))

console.log('TenAceIQ Customer Journey Flow Map')
console.log('')
console.log('Use this to test how each tier moves from entry to action, proof, handoff, and return state.')
console.log('Source: lib/customer-journey-flow-map.json')
console.log('')

for (const flow of flowMaps) {
  console.log(`${flow.label} (${flow.tierId})`)
  console.log(`- Persona: ${flow.persona}`)
  console.log(`- Pain point: ${flow.painPoint}`)
  console.log(`- Access rule: ${flow.accessRule}`)
  console.log(`- Entry: ${flow.entryRoute}`)
  console.log(`- Features: ${flow.primaryFeatureIds.join(', ')}`)
  console.log(`- Risk: ${flow.testRisk}`)
  console.log('- Steps:')

  for (const [index, step] of flow.steps.entries()) {
    console.log(`  ${index + 1}. ${step.stage} | ${step.surface} | ${step.route}`)
    console.log(`     Action: ${step.action}`)
    console.log(`     Signal: ${step.productSignal}`)
    console.log(`     Evidence: ${step.evidence}`)
  }

  if (flow.handoffs.length) {
    console.log('- Handoffs:')
    for (const handoff of flow.handoffs) {
      console.log(`  -> ${handoff.toTierId}: ${handoff.label}`)
      console.log(`     Trigger: ${handoff.trigger}`)
      console.log(`     Proof: ${handoff.proof}`)
    }
  }

  console.log('')
}

console.log('Closeout rule: every tested journey needs a visible entry, one useful next action, an honest proof signal, and a clear return state.')
