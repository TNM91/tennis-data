import { customerJourneyDetails, normalizeQaQuery, tierAliases } from './customer-journey-qa-data.mjs'

const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalizeQaQuery(rawQuery)

const tierOrder = ['free', 'player_plus', 'coach', 'captain', 'league', 'full_court', 'admin_internal']
const tierCardContent = {
  free: {
    preferredAlias: 'free',
    promise: 'Explore useful public tennis intelligence before being asked to upgrade.',
    testReadySignal: 'Public context, Data Assist, and upgrade handoff are understandable without private controls.',
    features: [
      {
        id: 'free-public-explore',
        label: 'Public Explore',
        route: '/explore',
        painPoint: 'Visitors do not know where to start or how to understand the tennis landscape around them.',
        proof: 'Useful public tennis context appears before upgrade copy.',
      },
      {
        id: 'free-data-assist-entry',
        label: 'Data Assist Entry',
        route: '/data-assist',
        painPoint: 'Users have updated scorecards, schedules, or rosters but no clear way to turn them into trusted platform context.',
        proof: 'Upload/review language is clear and does not imply instant trusted data.',
      },
    ],
    blockers: ['upgrade prompt appears before useful context', 'Data Assist implies instant trusted data', 'private workspace controls visible'],
  },
  player_plus: {
    preferredAlias: 'player',
    promise: 'Turn lessons, goals, and practice into visible progress with a player-linked home.',
    testReadySignal: 'Player can train on phone, log proof, return later, and understand the next useful action.',
    features: [
      {
        id: 'player-level-up',
        label: 'Level Up Portal',
        route: '/player-development/[identity]/level-up',
        painPoint: 'Players leave lessons without an easy on-court way to choose a focus, train it, and log proof quickly.',
        proof: 'Active task becomes the main phone screen and proof saves honestly.',
      },
      {
        id: 'player-level-up-content',
        label: 'Level Up Content Library',
        route: '/player-development/[identity]/level-up',
        painPoint: 'Training libraries can become generic, making it hard for players to know which drill actually helps their game.',
        proof: 'Recommended drill copy is tennis-specific, scoreable, and tied to a next rep.',
      },
      {
        id: 'player-my-lab',
        label: 'My Lab',
        route: '/mylab',
        painPoint: 'Players see tennis data in fragments and need one personal home that tells them what matters next.',
        proof: 'Linked profile, identity context, recent work, and next action survive refresh.',
      },
    ],
    blockers: ['too much scroll before action', 'generic drill copy', 'local proof presented as synced', 'generic empty dashboard'],
  },
  coach: {
    preferredAlias: 'coach',
    promise: 'Keep coach and player aligned between lessons through invite, assignment, proof, and lesson planning.',
    testReadySignal: 'Coach can assign one useful tool, review proof, and turn that into a practical next lesson.',
    features: [
      {
        id: 'coach-hub',
        label: 'Coach Hub',
        route: '/coach',
        painPoint: 'Coaches need one place to see students, assigned work, proof, and the next lesson focus between sessions.',
        proof: 'Student, assignment, proof, due state, and next implication are findable.',
      },
      {
        id: 'coach-invite-link',
        label: 'Coach Invite Link',
        route: '/coach/invite/[token]',
        painPoint: 'Coach-player alignment breaks when the player is not linked to the coach inside the platform.',
        proof: 'Disposable invite links the player to the coach and the relationship is clear to both sides.',
      },
      {
        id: 'coach-lesson-planner',
        label: 'Coach Lesson Planner',
        route: '/player-development/[identity]/coach-planner',
        painPoint: 'Lesson plans can drift away from the player identity, assigned work, and readiness signals.',
        proof: 'One-hour lesson blocks match identity, readiness, recent work, and assignment handoff.',
      },
    ],
    blockers: ['assignment visible to wrong player', 'coach cannot find proof', 'lesson plan disconnected from Level Up', 'player-facing copy in coach mode'],
  },
  captain: {
    preferredAlias: 'captain',
    promise: 'Move from availability and context to lineup choices and team communication.',
    testReadySignal: 'Captain can make a weekly decision and produce a useful team-facing update.',
    features: [
      {
        id: 'captain-lineup-week',
        label: 'Captain Lineup Week',
        route: '/captain',
        painPoint: 'Captains make weekly lineup decisions with scattered availability, readiness, scouting, and communication.',
        proof: 'Availability, scouting, lineup option, projection, and team brief connect in one week flow.',
      },
      {
        id: 'captain-compete-bridge',
        label: 'Compete Bridge',
        route: '/compete',
        painPoint: 'Team context, schedules, and results can feel disconnected from the captain actions they should inform.',
        proof: 'Compete context points clearly into captain decisions when the user has Captain access.',
      },
    ],
    blockers: ['availability disconnected from lineup', 'projection unclear', 'message or brief dead end', 'Captain tier copy missing'],
  },
  league: {
    preferredAlias: 'league',
    promise: 'Run league structure, schedules, results, standings, and visibility from one operating workspace.',
    testReadySignal: 'Coordinator operations and public/member league context stay connected without exposing private controls.',
    features: [
      {
        id: 'league-office',
        label: 'League Office',
        route: '/league-coordinator',
        painPoint: 'Coordinators often run structure, schedules, results, standings, and visibility across too many manual tools.',
        proof: 'Coordinator can manage fixture league data and see result/standings state.',
      },
      {
        id: 'league-public-context',
        label: 'Public League Context',
        route: '/leagues/[league]',
        painPoint: 'Members need a clear public or member-facing place to see league schedule, result, and standings context.',
        proof: 'Public/member league page reflects intended context without private controls.',
      },
    ],
    blockers: ['result does not propagate', 'private controls visible publicly', 'standings context missing', 'fixture data unsafe'],
  },
  full_court: {
    preferredAlias: 'full-court',
    promise: 'Give a multi-role user clean access to every paid workspace without tier confusion.',
    testReadySignal: 'Player, Coach, Captain, and League workspaces open without stale locks or redundant upgrade prompts.',
    features: [
      {
        id: 'full-court-navigation',
        label: 'Full-Court Navigation',
        route: '/pricing',
        painPoint: 'Multi-role users need all workspaces without repeated locks, duplicated prompts, or unclear role switching.',
        proof: 'Pricing explains access and every paid workspace opens cleanly for the full-access account.',
      },
    ],
    blockers: ['paid workspace locked', 'redundant upgrade prompt', 'role navigation confusing'],
  },
  admin_internal: {
    preferredAlias: 'admin',
    promise: 'Protect access and tennis data quality with fixture-safe internal workflows.',
    testReadySignal: 'Access repair and imported-data review are understandable, reflected in product surfaces, and safe for test data.',
    features: [
      {
        id: 'admin-access-management',
        label: 'Admin Access Management',
        route: '/admin/access',
        painPoint: 'Internal users need to activate and repair access without creating tier drift or billing confusion.',
        proof: 'Starting access, target access, affected surface, and rollback note are captured.',
      },
      {
        id: 'admin-data-quality',
        label: 'Admin Data Quality',
        route: '/admin/import-queue',
        painPoint: 'Imported tennis data needs review before it changes match history, rankings, player context, or league intelligence.',
        proof: 'Fixture import stays isolated and unreviewed data is not treated as trusted.',
      },
    ],
    blockers: ['test data not isolated', 'access change not reflected', 'unreviewed data treated as trusted', 'no rollback note'],
  },
}
const tiers = tierOrder.map(buildTier).filter((tier) => tier.journeys.length)

function findTier() {
  if (!rawQuery) return null

  const tierLabel = tierAliases.get(normalizedQuery)

  return tiers.find((tier) => tier.aliases.includes(normalizedQuery) || tier.label === tierLabel)
}

function printList() {
  console.log('Usage: npm run qa:tier -- <free | player | coach | captain | league | full-court | admin>')
  console.log('')
  console.log('Available tier cards:')
  for (const tier of tiers) {
    console.log(`- ${tier.preferredAlias} (${tier.label})`)
  }
}

function printTierCard(tier) {
  console.log(`${tier.label} Tier Readiness Card (${tier.id})`)
  console.log(`Tester fixture: ${tier.testerFixture}`)
  console.log(`Promise: ${tier.promise}`)
  console.log(`Ready when: ${tier.testReadySignal}`)
  console.log('')
  console.log('Feature proof:')
  for (const feature of tier.features) {
    console.log(`- ${feature.label} (${feature.id})`)
    console.log(`  Route: ${feature.route}`)
    console.log(`  Pain point: ${feature.painPoint}`)
    console.log(`  Proof: ${feature.proof}`)
  }
  console.log('')
  console.log('Journeys that prove this tier:')
  for (const journey of tier.journeys) console.log(`- ${journey}`)
  console.log('')
  console.log('Fail fast if you see:')
  for (const blocker of tier.blockers) console.log(`- ${blocker}`)
  console.log('')
  console.log('Use with:')
  console.log(`- npm run qa:journey -- ${tier.journeys[0]}`)
  console.log(`- npm run qa:focus -- ${tier.id}`)
  console.log('- npm run qa:fixtures')
  console.log('- npm run qa:gaps')
  console.log('- npm run qa:results')
  console.log('')
  console.log('Closeout rule: a tier is not test-ready until each listed journey has pass evidence and no open p0/p1 row remains for that tier.')
}

function buildTier(id) {
  const journeys = customerJourneyDetails.filter((journey) => journey.tierId === id)
  const label = journeys[0]?.tier ?? id
  const content = tierCardContent[id] ?? {}
  const aliases = new Set([normalizeQaQuery(id), normalizeQaQuery(label), normalizeQaQuery(content.preferredAlias ?? '')])

  for (const [alias, aliasLabel] of tierAliases) {
    if (aliasLabel === label) aliases.add(alias)
  }

  return {
    id,
    aliases: [...aliases].filter(Boolean),
    label,
    testerFixture: journeys[0]?.accountFixture ?? 'missing fixture',
    promise: content.promise ?? 'Missing tier promise.',
    testReadySignal: content.testReadySignal ?? 'Missing tier ready signal.',
    preferredAlias: content.preferredAlias ?? aliases.values().next().value,
    features: content.features ?? [],
    journeys: journeys.map((journey) => journey.id),
    blockers: content.blockers ?? [...new Set(journeys.flatMap((journey) => journey.failFastSignals))],
  }
}

console.log('TenAceIQ Customer Journey Tier Card')
console.log('')

const tier = findTier()

if (!tier) {
  if (rawQuery) {
    console.log(`No tier matched "${rawQuery}".`)
    console.log('')
  }
  printList()
  process.exit(rawQuery ? 1 : 0)
}

printTierCard(tier)
