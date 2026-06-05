const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    entryRoute: '/player-development/relentless-competitor-4-0/level-up',
    accountFixture: 'player_plus_linked',
    successSignal: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
    evidence: ['phone screenshot of active card', 'saved proof status text', 'next recommendation', 'tiny note behavior'],
    failFast: ['too much scroll before action', 'local proof presented as synced', 'generic drill copy', 'missing next action'],
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    entryRoute: '/coach',
    accountFixture: 'coach_primary',
    successSignal: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
    evidence: ['invite link state', 'assignment id', 'player challenge screen', 'coach review screen', 'proof rating and note'],
    failFast: ['assignment visible to wrong player', 'proof only local when UI says synced', 'coach cannot find proof', 'no next lesson handoff'],
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    entryRoute: '/player-development/relentless-competitor-4-0/coach-planner',
    accountFixture: 'coach_primary',
    successSignal: 'The planner is coach-facing, practical, and connected to the player Level Up path.',
    evidence: ['planner identity', 'warm-up block', 'skill block', 'pressure block', 'assignment handoff'],
    failFast: ['player-facing workbook copy', 'lesson plan feels disconnected from Level Up', 'no assignment handoff'],
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    entryRoute: '/mylab',
    accountFixture: 'player_plus_linked',
    successSignal: 'My Lab makes the player identity, linked profile, and next action clear after refresh.',
    evidence: ['linked profile state', 'identity signal', 'next action', 'post-refresh state'],
    failFast: ['generic empty dashboard', 'linked player unclear', 'next action missing', 'stale upgrade lock'],
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    entryRoute: '/captain',
    accountFixture: 'captain_primary',
    successSignal: 'Captain can make a weekly decision and produce a useful team-facing update.',
    evidence: ['availability state', 'lineup option', 'projection/scenario result', 'team brief or message'],
    failFast: ['availability disconnected from lineup', 'projection unclear', 'message/brief dead end', 'Captain tier copy missing'],
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    entryRoute: '/league-coordinator',
    accountFixture: 'league_coordinator',
    successSignal: 'Coordinator operation and member-facing league context stay connected without exposing private controls.',
    evidence: ['result fixture', 'coordinator source screen', 'public league screen', 'privacy check'],
    failFast: ['result does not propagate', 'private controls visible publicly', 'standings context missing', 'fixture data unsafe'],
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    entryRoute: '/pricing',
    accountFixture: 'full_court_operator',
    successSignal: 'All paid workspaces open cleanly and the user can tell which workspace fits the job.',
    evidence: ['pricing tier copy', 'Player workspace', 'Coach workspace', 'Captain workspace', 'League workspace'],
    failFast: ['paid workspace locked', 'redundant upgrade prompt', 'role navigation confusing'],
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    entryRoute: '/admin/access',
    accountFixture: 'admin_test',
    successSignal: 'Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces.',
    evidence: ['test profile', 'starting access', 'target access', 'import review status', 'affected surface'],
    failFast: ['test data not isolated', 'access change not reflected', 'unreviewed data treated as trusted', 'no rollback note'],
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    entryRoute: '/explore',
    accountFixture: 'free_viewer',
    successSignal: 'Public tennis intelligence is visible first, and upgrade/data-assist paths are clear.',
    evidence: ['Explore route', 'public detail page', 'pricing handoff', 'Data Assist review language'],
    failFast: ['upgrade prompt appears before useful context', 'public detail unavailable', 'Data Assist implies instant trusted data'],
  },
]

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
