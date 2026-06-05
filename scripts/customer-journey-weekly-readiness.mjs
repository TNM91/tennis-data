const weeklyPlan = [
  {
    day: 'Day 1',
    focus: 'Trust Loop',
    journeyIds: ['player-level-up-mobile-loop', 'coach-player-assigned-challenge'],
    fixtures: ['player_plus_linked', 'coach_primary', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
  },
  {
    day: 'Day 2',
    focus: 'Player And Coach Depth',
    journeyIds: ['coach-lesson-support', 'player-my-lab-return-state'],
    fixtures: ['coach_primary', 'player_plus_linked', 'linked-player-profile', 'level-up-assignment'],
  },
  {
    day: 'Day 3',
    focus: 'Captain Week',
    journeyIds: ['captain-week-flow'],
    fixtures: ['captain_primary', 'captain-team-week'],
  },
  {
    day: 'Day 4',
    focus: 'League And Admin',
    journeyIds: ['league-result-to-public-context', 'admin-access-and-data-quality'],
    fixtures: ['league_coordinator', 'league-week', 'admin_test', 'admin-access-repair', 'data-assist-upload'],
  },
  {
    day: 'Day 5',
    focus: 'Full-Court And Free/Public Regression',
    journeyIds: ['full-court-access-pass', 'free-public-discovery'],
    fixtures: ['full_court_operator', 'full-court-access-state', 'free_viewer', 'data-assist-upload'],
  },
]

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
