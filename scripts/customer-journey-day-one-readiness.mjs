const dayOneJourneys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    fixtureIds: ['player_plus_linked', 'level-up-completion'],
    entryRoute: '/player-development/relentless-competitor-4-0/level-up',
    passSignal: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    fixtureIds: ['coach_primary', 'player_plus_linked', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
    entryRoute: '/coach',
    passSignal: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
  },
]

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
