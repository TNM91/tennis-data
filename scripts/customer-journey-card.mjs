const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = rawQuery.replace(/\s+/g, '-')

const tierLabels = {
  free: 'Free',
  player_plus: 'Player+',
  coach: 'Coach',
  captain: 'Captain',
  league: 'TIQ League Coordinator/Admin',
  full_court: 'Full-Court',
  admin_internal: 'Admin/Internal',
}

const journeys = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    tierId: 'player_plus',
    risk: 'critical',
    personaFixture: 'player_plus_linked',
    featureIds: ['player-level-up', 'player-level-up-content'],
    fixtureIds: ['player_plus_linked', 'level-up-completion'],
    entryRoute: '/player-development/relentless-competitor-4-0/level-up',
    primaryQuestion: 'Can a player start useful tennis work on a phone, score proof, and know the next rep without extra scrolling?',
    successSignal: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
    failFastSignals: ['too much scroll before action', 'local proof presented as synced', 'generic drill copy', 'missing next action'],
    evidenceToCapture: ['phone screenshot of active card', 'saved proof status text', 'next recommendation', 'tiny note behavior'],
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    tierId: 'coach',
    risk: 'critical',
    personaFixture: 'coach_primary',
    featureIds: ['coach-hub', 'coach-invite-link', 'player-level-up'],
    fixtureIds: ['coach_primary', 'player_plus_linked', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
    entryRoute: '/coach',
    primaryQuestion: 'Can a coach assign one useful tool and see the player proof come back through the linked relationship?',
    successSignal: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
    failFastSignals: ['assignment visible to wrong player', 'proof only local when UI says synced', 'coach cannot find proof', 'no next lesson handoff'],
    evidenceToCapture: ['invite link state', 'assignment id', 'player challenge screen', 'coach review screen', 'proof rating and note'],
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    tierId: 'coach',
    risk: 'high',
    personaFixture: 'coach_primary',
    featureIds: ['coach-lesson-planner', 'player-level-up-content'],
    fixtureIds: ['coach_primary', 'linked-player-profile', 'level-up-assignment'],
    entryRoute: '/player-development/relentless-competitor-4-0/coach-planner',
    primaryQuestion: 'Can the coach turn identity, readiness, and assigned work into a useful one-hour lesson plan?',
    successSignal: 'The planner is coach-facing, practical, and connected to the player Level Up path.',
    failFastSignals: ['player-facing workbook copy', 'lesson plan feels disconnected from Level Up', 'no assignment handoff'],
    evidenceToCapture: ['planner identity', 'warm-up block', 'skill block', 'pressure block', 'assignment handoff'],
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    tierId: 'player_plus',
    risk: 'high',
    personaFixture: 'player_plus_linked',
    featureIds: ['player-my-lab'],
    fixtureIds: ['player_plus_linked', 'linked-player-profile'],
    entryRoute: '/mylab',
    primaryQuestion: 'Can a player come back later and understand their personal tennis context and next useful action?',
    successSignal: 'My Lab makes the player identity, linked profile, and next action clear after refresh.',
    failFastSignals: ['generic empty dashboard', 'linked player unclear', 'next action missing', 'stale upgrade lock'],
    evidenceToCapture: ['linked profile state', 'identity signal', 'next action', 'post-refresh state'],
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    tierId: 'captain',
    risk: 'high',
    personaFixture: 'captain_primary',
    featureIds: ['captain-lineup-week', 'captain-compete-bridge'],
    fixtureIds: ['captain_primary', 'captain-team-week'],
    entryRoute: '/captain',
    primaryQuestion: 'Can a captain move from availability and scouting to lineup choice and team communication?',
    successSignal: 'Captain can make a weekly decision and produce a useful team-facing update.',
    failFastSignals: ['availability disconnected from lineup', 'projection unclear', 'message/brief dead end', 'Captain tier copy missing'],
    evidenceToCapture: ['availability state', 'lineup option', 'projection/scenario result', 'team brief or message'],
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    tierId: 'league',
    risk: 'high',
    personaFixture: 'league_coordinator',
    featureIds: ['league-office', 'league-public-context'],
    fixtureIds: ['league_coordinator', 'league-week'],
    entryRoute: '/league-coordinator',
    primaryQuestion: 'Can a coordinator record or review league results and see the intended public/member context update?',
    successSignal: 'Coordinator operation and member-facing league context stay connected without exposing private controls.',
    failFastSignals: ['result does not propagate', 'private controls visible publicly', 'standings context missing', 'fixture data unsafe'],
    evidenceToCapture: ['result fixture', 'coordinator source screen', 'public league screen', 'privacy check'],
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    tierId: 'full_court',
    risk: 'medium',
    personaFixture: 'full_court_operator',
    featureIds: ['full-court-navigation'],
    fixtureIds: ['full_court_operator', 'full-court-access-state'],
    entryRoute: '/pricing',
    primaryQuestion: 'Can a multi-role user move through Player, Coach, Captain, and League surfaces without stale locks?',
    successSignal: 'All paid workspaces open cleanly and the user can tell which workspace fits the job.',
    failFastSignals: ['paid workspace locked', 'redundant upgrade prompt', 'role navigation confusing'],
    evidenceToCapture: ['pricing tier copy', 'Player workspace', 'Coach workspace', 'Captain workspace', 'League workspace'],
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    tierId: 'admin_internal',
    risk: 'high',
    personaFixture: 'admin_test',
    featureIds: ['admin-access-management', 'admin-data-quality', 'free-data-assist-entry'],
    fixtureIds: ['admin_test', 'admin-access-repair', 'data-assist-upload'],
    entryRoute: '/admin/access',
    primaryQuestion: 'Can internal users repair access and protect imported tennis data without changing real customer data?',
    successSignal: 'Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces.',
    failFastSignals: ['test data not isolated', 'access change not reflected', 'unreviewed data treated as trusted', 'no rollback note'],
    evidenceToCapture: ['test profile', 'starting access', 'target access', 'import review status', 'affected surface'],
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    tierId: 'free',
    risk: 'medium',
    personaFixture: 'free_viewer',
    featureIds: ['free-public-explore', 'free-data-assist-entry'],
    fixtureIds: ['free_viewer', 'data-assist-upload'],
    entryRoute: '/explore',
    primaryQuestion: 'Can a visitor find useful tennis context before being asked to upgrade?',
    successSignal: 'Public tennis intelligence is visible first, and upgrade/data-assist paths are clear.',
    failFastSignals: ['upgrade prompt appears before useful context', 'public detail unavailable', 'Data Assist implies instant trusted data'],
    evidenceToCapture: ['Explore route', 'public detail page', 'pricing handoff', 'Data Assist review language'],
  },
]

function searchableText(journey) {
  return [
    journey.id,
    journey.label,
    journey.tierId,
    tierLabels[journey.tierId],
    journey.risk,
    journey.personaFixture,
    journey.entryRoute,
    ...journey.featureIds,
    ...journey.fixtureIds,
    ...journey.failFastSignals,
    ...journey.evidenceToCapture,
  ]
    .join(' ')
    .toLowerCase()
}

function getMatches() {
  if (!rawQuery) return []

  const exact = journeys.find((journey) => journey.id === normalizedQuery || journey.label.toLowerCase() === rawQuery)
  if (exact) return [exact]

  const tierId = Object.entries(tierLabels).find(([id, label]) => {
    const normalizedLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    return id.replace(/_/g, '-') === normalizedQuery || normalizedLabel === normalizedQuery
  })?.[0]

  if (tierId) return journeys.filter((journey) => journey.tierId === tierId)

  return journeys.filter((journey) => searchableText(journey).includes(rawQuery))
}

function printList() {
  console.log('Usage: npm run qa:journey -- <journey-id | tier | search>')
  console.log('')
  console.log('Available journey cards:')
  for (const journey of journeys) {
    console.log(`- ${journey.id} (${tierLabels[journey.tierId]}, ${journey.risk})`)
  }
}

function printJourneyCard(journey) {
  console.log(`${journey.label} (${journey.id})`)
  console.log(`Tier: ${tierLabels[journey.tierId]} | Risk: ${journey.risk}`)
  console.log(`Persona fixture: ${journey.personaFixture}`)
  console.log(`Entry route: ${journey.entryRoute}`)
  console.log('')
  console.log(`Question: ${journey.primaryQuestion}`)
  console.log(`Pass signal: ${journey.successSignal}`)
  console.log('')
  console.log('Fail fast:')
  for (const signal of journey.failFastSignals) console.log(`- ${signal}`)
  console.log('')
  console.log('Evidence to capture:')
  for (const evidence of journey.evidenceToCapture) console.log(`- ${evidence}`)
  console.log('')
  console.log(`Fixtures: ${journey.fixtureIds.join(', ')}`)
  console.log(`Features: ${journey.featureIds.join(', ')}`)
  console.log('')
  console.log('Use with:')
  console.log(`- npm run qa:focus -- ${journey.tierId}`)
  console.log('- npm run qa:fixtures')
  console.log('- npm run qa:evidence')
  console.log('- npm run qa:triage')
  console.log('- npm run qa:results')
  console.log('')
  console.log('Closeout rule: record every attempt in docs/customer-journey-test-results.md and do not mark pass until the evidence proves the pain point was solved.')
}

console.log('TenAceIQ Customer Journey Card')
console.log('')

const matches = getMatches()

if (!matches.length) {
  if (rawQuery) {
    console.log(`No journey matched "${rawQuery}".`)
    console.log('')
  }
  printList()
  process.exit(rawQuery ? 1 : 0)
}

if (matches.length > 1) {
  console.log(`Matched ${matches.length} journey cards for "${rawQuery}":`)
  console.log('')
  for (const journey of matches) {
    console.log(`- ${journey.id} (${tierLabels[journey.tierId]}, ${journey.risk})`)
    console.log(`  ${journey.label}`)
    console.log(`  Route: ${journey.entryRoute}`)
  }
  console.log('')
  console.log('Run again with a specific journey id for the full field card.')
  process.exit(0)
}

printJourneyCard(matches[0])
