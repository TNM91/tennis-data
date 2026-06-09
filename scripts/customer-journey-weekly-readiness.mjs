import { customerJourneySessions } from './customer-journey-qa-data.mjs'

const weeklyPlan = customerJourneySessions.map((session) => ({
  day: session.shortLabel,
  focus: session.focus,
  journeyIds: session.journeyIds,
  fixtures: session.fixtureIds,
}))

const docs = [
  'docs/customer-journey-weekly-runbook.md',
  'docs/customer-journey-day-one-runbook.md',
  'docs/customer-journey-test-plan.md',
  'docs/customer-journey-test-results.md',
  'docs/customer-journey-test-fixtures.md',
  'docs/platform-closeout-verification-log.md',
]

const commands = [
  'npm run qa:day1',
  'npm run verify:closeout:live',
  'npm run verify:closeout',
]

const allFixtures = [...new Set(weeklyPlan.flatMap((day) => day.fixtures))]

console.log('TenAceIQ Weekly Journey Testing Readiness')
console.log('')
console.log('Run during the week:')
for (const command of commands) {
  console.log(`- ${command}`)
}

console.log('')
console.log('Open these docs:')
for (const doc of docs) {
  console.log(`- ${doc}`)
}

console.log('')
console.log('Confirm these fixture IDs exist across the week:')
for (const fixture of allFixtures) {
  console.log(`- ${fixture}`)
}

console.log('')
console.log('Weekly sequence:')
for (const day of weeklyPlan) {
  console.log(`- ${day.day}: ${day.focus}`)
  console.log(`  Journeys: ${day.journeyIds.join(', ')}`)
  console.log(`  Fixtures: ${day.fixtures.join(', ')}`)
}

console.log('')
console.log('Closeout rule: every journey needs at least one result row, and every p0/p1 needs a fix or launch decision.')
