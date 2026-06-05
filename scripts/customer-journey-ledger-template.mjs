const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    entryRoute: '/player-development/relentless-competitor-4-0/level-up',
    accountFixture: 'player_plus_linked',
  },
  {
    id: 'coach-player-assigned-challenge',
    entryRoute: '/coach',
    accountFixture: 'coach_primary',
  },
  {
    id: 'coach-lesson-support',
    entryRoute: '/player-development/relentless-competitor-4-0/coach-planner',
    accountFixture: 'coach_primary',
  },
  {
    id: 'player-my-lab-return-state',
    entryRoute: '/mylab',
    accountFixture: 'player_plus_linked',
  },
  {
    id: 'captain-week-flow',
    entryRoute: '/captain',
    accountFixture: 'captain_primary',
  },
  {
    id: 'league-result-to-public-context',
    entryRoute: '/league-coordinator',
    accountFixture: 'league_coordinator',
  },
  {
    id: 'full-court-access-pass',
    entryRoute: '/pricing',
    accountFixture: 'full_court_operator',
  },
  {
    id: 'admin-access-and-data-quality',
    entryRoute: '/admin/access',
    accountFixture: 'admin_test',
  },
  {
    id: 'free-public-discovery',
    entryRoute: '/explore',
    accountFixture: 'free_viewer',
  },
]

console.log('TenAceIQ Customer Journey Ledger Rows')
console.log('')
console.log('Paste these into docs/customer-journey-test-results.md under Result Ledger.')
console.log('')
console.log('| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')

for (const journey of journeys) {
  console.log(
    `|  |  |  | ${journey.accountFixture} | ${journey.id} | ${journey.entryRoute} | needs-follow-up |  |  |  |  |  |`
  )
}

console.log('')
console.log('Use result values: pass, fail, blocked, needs-follow-up.')
console.log('Use severity values: p0, p1, p2, p3.')
