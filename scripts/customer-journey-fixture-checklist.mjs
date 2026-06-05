const accountFixtures = [
  {
    id: 'free_viewer',
    role: 'Free / signed out or basic account',
    purpose: 'Public discovery and upgrade path',
    requiredAccess: 'Public Explore, players, teams, leagues, rankings, Data Assist entry',
  },
  {
    id: 'player_plus_linked',
    role: 'Player',
    purpose: 'My Lab, Level Up, player-linked return state',
    requiredAccess: 'Player access, linked player profile, Level Up local/completion state',
  },
  {
    id: 'coach_primary',
    role: 'Coach',
    purpose: 'Coach hub, invite, assignment, review',
    requiredAccess: 'Coach access, student list, assignment ability',
  },
  {
    id: 'captain_primary',
    role: 'Captain',
    purpose: 'Captain week flow',
    requiredAccess: 'Captain access plus Player access',
  },
  {
    id: 'league_coordinator',
    role: 'League',
    purpose: 'League Office operations',
    requiredAccess: 'League coordinator access',
  },
  {
    id: 'full_court_operator',
    role: 'Full-Court',
    purpose: 'Multi-role access pass',
    requiredAccess: 'Player, Coach, Captain, League workspaces',
  },
  {
    id: 'admin_test',
    role: 'Admin/Internal',
    purpose: 'Access repair and data quality',
    requiredAccess: 'Admin access with safe test profiles and import fixtures only',
  },
]

const dataFixtures = [
  ['linked-player-profile', 'Player profile, identity slug, and recent context fixture.'],
  ['coach-invite-token', 'Fresh disposable coach invite token.'],
  ['level-up-assignment', 'Coach-assigned card or module fixture.'],
  ['level-up-completion', 'Proof rating, tiny note, completion date, and optional assignment link.'],
  ['captain-team-week', 'Roster, availability, opponent/context, and lineup scenario fixture.'],
  ['league-week', 'League schedule, result, standings, and public-page expectation fixture.'],
  ['data-assist-upload', 'Safe scorecard or schedule upload fixture.'],
  ['full-court-access-state', 'All-workspace access fixture with no stale upgrade locks.'],
  ['admin-access-repair', 'Test profile with starting access, target access, and rollback note.'],
]

const setupOrder = [
  'Confirm admin_test can inspect and repair test profiles.',
  'Confirm paid access states for player_plus_linked, coach_primary, captain_primary, league_coordinator, and full_court_operator.',
  'Create or verify linked-player-profile.',
  'Create coach-invite-token and link player.',
  'Create level-up-assignment and level-up-completion fixtures.',
  'Create captain-team-week fixture.',
  'Create league-week fixture.',
  'Prepare safe data-assist-upload fixture.',
]

console.log('TenAceIQ Customer Journey Fixture Checklist')
console.log('')
console.log('Source: docs/customer-journey-test-fixtures.md')
console.log('Keep credentials, secrets, and private customer data out of the repo.')
console.log('')

console.log('Account fixtures:')
for (const fixture of accountFixtures) {
  console.log(`- ${fixture.id}: ${fixture.role}`)
  console.log(`  Purpose: ${fixture.purpose}`)
  console.log(`  Required access: ${fixture.requiredAccess}`)
}

console.log('')
console.log('Data fixtures:')
for (const [id, meaning] of dataFixtures) {
  console.log(`- ${id}: ${meaning}`)
}

console.log('')
console.log('Setup order:')
setupOrder.forEach((step, index) => {
  console.log(`${index + 1}. ${step}`)
})

console.log('')
console.log('Closeout rule: if a required account or data fixture is missing, log fixture-gap and rerun; do not mark the product passed.')
