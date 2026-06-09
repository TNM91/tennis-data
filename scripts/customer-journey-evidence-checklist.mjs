import { customerJourneyDetails } from './customer-journey-qa-data.mjs'

const journeys = customerJourneyDetails.map((journey) => ({
  id: journey.id,
  label: journey.label,
  entryRoute: journey.entryRoute,
  accountFixture: journey.accountFixture,
  successSignal: journey.passSignal,
  evidence: journey.evidence,
  failFast: journey.failFastSignals,
}))

console.log('TenAceIQ Customer Journey Evidence Checklist')
console.log('')
console.log('Use this while recording results in docs/customer-journey-test-results.md.')
console.log('')

for (const journey of journeys) {
  console.log(`${journey.label} (${journey.id})`)
  console.log(`  Route: ${journey.entryRoute}`)
  console.log(`  Fixture: ${journey.accountFixture}`)
  console.log(`  Pass signal: ${journey.successSignal}`)
  console.log(`  Evidence: ${journey.evidence.join('; ')}`)
  console.log(`  Fail fast: ${journey.failFast.join('; ')}`)
}

console.log('')
console.log('Closeout rule: do not mark pass unless evidence proves the pain point was solved, not just that the page loaded.')
