import { customerJourneySessions, journeyById } from './customer-journey-qa-data.mjs'

const dayOneSession = customerJourneySessions.find((session) => session.id === 'day1')
const dayOneJourneys =
  dayOneSession?.journeyIds.map((journeyId) => {
    const journey = journeyById.get(journeyId)

    return {
      id: journeyId,
      label: journey?.label ?? journeyId,
      fixtureIds: journey?.fixtureIds ?? [],
      entryRoute: journey?.entryRoute ?? 'missing entry route',
      passSignal: journey?.passSignal ?? 'missing pass signal',
    }
  }) ?? []

const docs = [
  'docs/customer-journey-day-one-runbook.md',
  'docs/customer-journey-test-plan.md',
  'docs/customer-journey-test-results.md',
  'docs/customer-journey-test-fixtures.md',
  'docs/level-up-sync-audit.md',
  'docs/platform-closeout-verification-log.md',
]

const commands = [
  'npm run verify:closeout:live',
  'npm run verify:closeout',
]

const allFixtures = [...new Set(dayOneJourneys.flatMap((journey) => journey.fixtureIds))]

console.log('TenAceIQ Day 1 Journey Testing Readiness')
console.log('')
console.log('Run before manual testing:')
for (const command of commands) {
  console.log(`- ${command}`)
}

console.log('')
console.log('Open these docs:')
for (const doc of docs) {
  console.log(`- ${doc}`)
}

console.log('')
console.log('Confirm these fixture IDs exist:')
for (const fixture of allFixtures) {
  console.log(`- ${fixture}`)
}

console.log('')
console.log('Day 1 journeys:')
for (const journey of dayOneJourneys) {
  console.log(`- ${journey.id}: ${journey.label}`)
  console.log(`  Entry: ${journey.entryRoute}`)
  console.log(`  Fixtures: ${journey.fixtureIds.join(', ')}`)
  console.log(`  Pass: ${journey.passSignal}`)
}

console.log('')
console.log('Record every attempt in docs/customer-journey-test-results.md.')
