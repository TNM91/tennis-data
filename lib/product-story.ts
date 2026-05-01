export const PRODUCT_NORTH_STAR =
  'TenAceIQ helps tennis players, captains, and league coordinators spend less time guessing, more time understanding, and more time playing.'

export const PRODUCT_UPGRADE_MESSAGE =
  'Upgrade based on what makes your tennis life easier: simple tiers, simple tools, clearer next steps.'

export const PRODUCT_PRINCIPLES = [
  'Simple tiers',
  'Clear upgrade value',
  'Tennis-specific intelligence',
  'Practical tools over generic dashboards',
  'Personalized insight for players',
  'Team decision support for captains',
  'League operations for coordinators and admins',
] as const

export const PRODUCT_AVOID_LIST = [
  'Vague SaaS language',
  'Bloated feature lists',
  'Generic dashboard copy',
  'Decorative pages that do not help users act',
  'Tier confusion',
  'Copy that sounds disconnected from tennis',
] as const

export type MembershipTierId = 'free' | 'player_plus' | 'captain' | 'league'

export type MembershipTier = {
  id: MembershipTierId
  name: string
  shortPromise: string
  audience: string
  upgradeCue: string
  description: string
  valueProps: string[]
}

export const MEMBERSHIP_TIERS: Record<MembershipTierId, MembershipTier> = {
  free: {
    id: 'free',
    name: 'Free',
    shortPromise: 'Explore the tennis landscape.',
    audience: 'Players, captains, and fans getting oriented',
    upgradeCue: 'Start with public tennis intelligence.',
    description:
      'Explore players, leagues, teams, rankings, and public tennis intelligence before you need personal tools.',
    valueProps: [
      'Search players, teams, leagues, and rankings',
      'View public tennis context',
      'Understand the landscape before upgrading',
    ],
  },
  player_plus: {
    id: 'player_plus',
    name: 'Player',
    shortPromise: 'Personalize TenAceIQ around your game.',
    audience: 'Players who want clearer prep and a personalized tennis home',
    upgradeCue: 'Unlock My Lab, follows, matchups, and player-linked insight.',
    description:
      'Unlock My Lab, follow the players, teams, and leagues that matter to you, compare matchups, and link your player identity to the site.',
    valueProps: [
      'Unlock My Lab',
      'Follow players, teams, leagues, and rankings',
      'Compare how you and others may fare in matchups',
      'Connect your player identity to TenAceIQ',
    ],
  },
  captain: {
    id: 'captain',
    name: 'Captain',
    shortPromise: 'Make team decisions with more clarity.',
    audience: 'Captains managing lineups, readiness, and weekly decisions',
    upgradeCue: 'Add captain tools on top of Player features.',
    description:
      'Use Player features plus captain tools for lineups, scouting, team decisions, player readiness, and weekly team flow.',
    valueProps: [
      'Build and compare lineups',
      'Scout players and teams',
      'Track availability and readiness',
      'Make weekly team decisions with less guesswork',
    ],
  },
  league: {
    id: 'league',
    name: 'TIQ League Coordinator',
    shortPromise: 'Run leagues with less manual work.',
    audience: 'League coordinators and admins running players or teams',
    upgradeCue: 'Operate a league of players or teams from one place.',
    description:
      'Run leagues of players or teams with structure, visibility, participation, rankings, results, and admin workflows.',
    valueProps: [
      'Manage league structure and visibility',
      'Coordinate player or team participation',
      'Track rankings, schedules, and results',
      'Reduce manual league operations',
    ],
  },
} as const

export const MEMBERSHIP_TIER_ORDER: MembershipTierId[] = ['free', 'player_plus', 'captain', 'league']

export const PRODUCT_PROOF_POINTS = [
  'Less guessing',
  'Clearer match prep',
  'Smarter team decisions',
  'Cleaner league operations',
] as const

export type TierHomepageStory = {
  stage: string
  headline: string
  copy: string
  bullets: string[]
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  featuredNote?: string
}

export const TIER_HOMEPAGE_STORY: Record<MembershipTierId, TierHomepageStory> = {
  free: {
    stage: 'Start here',
    headline: 'Start free. Explore the tennis landscape.',
    copy: 'Search players, teams, leagues, rankings, flights, and areas before you need personal tools.',
    bullets: [
      'Search players, teams, leagues, and rankings',
      'Find public tennis context fast',
      'Understand the landscape before upgrading',
    ],
    primaryCta: { label: 'Get Started Free', href: '/join' },
    secondaryCta: { label: 'Explore TIQ', href: '/explore' },
  },
  player_plus: {
    stage: 'Player unlock',
    headline: 'Make TenAceIQ personal.',
    copy: 'Unlock My Lab, follow what matters, compare matchups, and link your player identity to the site.',
    bullets: [
      'Make My Lab your tennis home',
      'Follow players, teams, leagues, and rankings',
      'Compare matchups before you play',
    ],
    primaryCta: { label: 'Unlock Player', href: '/pricing' },
    secondaryCta: { label: 'Open My Lab', href: '/mylab' },
  },
  captain: {
    stage: 'Captain unlock',
    headline: 'Run the team week with more clarity.',
    copy: 'Use Player features plus captain tools for lineups, scouting, readiness, and weekly team decisions.',
    bullets: [
      'Build lineups with less guesswork',
      'Scout players and teams before decisions',
      'Track readiness and keep the week moving',
    ],
    primaryCta: { label: 'Unlock Captain Tools', href: '/pricing' },
    secondaryCta: { label: 'See Captain tools', href: '/captain' },
    featuredNote: 'Best for captains who want fewer scattered texts and clearer weekly decisions.',
  },
  league: {
    stage: 'Coordinator unlock',
    headline: 'Run leagues with less manual work.',
    copy: 'Manage leagues of players or teams with structure, visibility, participation, rankings, results, and admin workflows.',
    bullets: [
      'Manage league structure and visibility',
      'Coordinate players or teams',
      'Track rankings, schedules, and results',
    ],
    primaryCta: { label: 'Run Your League on TIQ', href: '/pricing' },
    secondaryCta: { label: 'Explore Leagues', href: '/explore/leagues' },
  },
}

export const HOME_HERO_STORY = {
  eyebrow: 'Tennis intelligence by role',
  badge: 'Explore. Personalize. Lead.',
  kicker: 'Start free. Upgrade when it makes tennis easier.',
  headlineTop: 'Less time guessing.',
  headlineBottom: 'More time understanding.',
  body:
    'Explore the tennis landscape for free. Upgrade to Player, Captain, or TIQ League Coordinator when you want personal insight, team decisions, or league operations in one place. Then all that is left is to go play.',
  proof: ['Free exploration', 'Player My Lab', 'Captain tools', 'Go play'],
} as const

export const MY_LAB_STORY = {
  eyebrow: 'Player unlock',
  headline: 'My Lab makes TenAceIQ personal.',
  body:
    'Follow the players, teams, leagues, and rankings that matter to you. Link your player identity, compare matchups, and turn scattered tennis activity into a clearer next step.',
  railKicker: 'Why Player unlocks it',
  railTitle: 'Your tennis life, cleaned up',
  upgradeHeadline: 'Build your personal tennis lab',
  upgradeBody:
    'Player unlocks My Lab, follows, matchup insight, and a player-linked experience built around your game.',
  upgradeCta: 'Unlock My Lab with Player',
  upgradeSecondary: 'See Player plan',
  upgradeFootnote: 'Best for players who want smarter match prep and one home for their tennis.',
} as const

export const MATCHUP_STORY = {
  eyebrow: 'Player unlock',
  headline: 'See how the match may play before you play it.',
  body:
    'Compare players or doubles teams by rating, form, head-to-head history, and projected edge. Matchup turns scattered results into a clearer read on what to expect next.',
  upgradeHeadline: 'Unlock Matchup with Player',
  upgradeBody:
    'Player unlocks Matchup, My Lab, follows, and player-linked prep so your tennis context follows you from scouting to match day.',
  upgradeCta: 'Unlock Matchup with Player',
  upgradeSecondary: 'See Player plan',
  upgradeFootnote: 'Best for players who want less guessing before the next match.',
  proof: ['Player prep', 'Rating gap', 'Recent form', 'Head-to-head'],
  readoutTitle: 'Use Matchup as a decision aid, not a guarantee.',
  readoutBody:
    'The projection is most useful when you combine probability, confidence, head-to-head history, and the surrounding roster decision.',
} as const

export const CAPTAIN_STORY = {
  eyebrow: 'Captain unlock',
  headline: 'Make the team week easier to run.',
  body:
    'Use Player features plus captain tools for availability, lineup decisions, scenario testing, scouting, messaging, and match-day readiness.',
  quickStartKicker: 'Captain weekly flow',
  quickStartTitle: 'Move from uncertainty to a team plan',
  activeTitle: 'Captain keeps this team organized.',
  activeBody:
    'Save time, build smarter lineups, keep availability visible, and send team updates from one place.',
  upgradeHeadline: 'Still building the week from scattered texts?',
  upgradeBody:
    'Captain brings availability, lineup building, scenario testing, scouting, readiness, and team messaging into one weekly workflow.',
  upgradeResult: 'Spend less time chasing answers and more time sending a lineup you trust.',
  upgradeCta: 'Unlock Captain Tools',
  lockedMessage:
    'Unlock Captain to save time, reduce stress, and build clearer weekly team plans.',
  workflow: [
    ['1', 'Know who can play', 'Confirm availability and response risk before lineup pressure starts.'],
    ['2', 'Build your lineup', 'Turn the player pool into the strongest weekly shape.'],
    ['3', 'Test the alternatives', 'Compare scenarios before you commit.'],
    ['4', 'Send the plan', 'Share lineup, logistics, reminders, and follow-ups.'],
    ['5', 'Review match day', 'Open the brief and check the next action.'],
  ],
} as const

export const LEAGUE_COORDINATOR_STORY = {
  eyebrow: 'TIQ League Coordinator unlock',
  headline: 'Run player or team leagues with less manual work.',
  body:
    'Create the league container, choose the format, seed players or teams, and keep league structure, visibility, participation, rankings, and operations in one place.',
  subnavTitle: 'League Coordinator tools inside the captain command center',
  subnavDescription:
    'Create and manage TIQ seasons while staying connected to captain and player workflows.',
  newLeagueTitle: 'Create league setup',
  newLeagueBody:
    'Team leagues are roster-oriented. Individual leagues are player-vs-player. Both need clean structure before standings, schedules, and communication can work.',
  upgradeHeadline: 'Ready to run organized competition without spreadsheets?',
  upgradeBody:
    'TIQ League Coordinator gives organizers a cleaner way to create seasons, structure participation, track results, and keep standings and communication in one place.',
  draftUpgradeHeadline: 'Need this draft to become a real league workspace?',
  draftUpgradeBody:
    'TIQ League Coordinator turns setup into a usable organizer layer with season structure, scheduling, standings, participants, and clearer league coordination.',
  registryTitle: 'Current TIQ league definitions',
  registryBody:
    'These league records power team views, player workflows, standings, and organizer operations while keeping team leagues and individual leagues clearly separated.',
  finalUpgradeHeadline: 'Ready to run the season without spreadsheet cleanup?',
  finalUpgradeBody:
    'TIQ League Coordinator turns league records into one cleaner system for scheduling, standings, team or player structure, and league-wide communication.',
  cta: 'Run Your League on TIQ',
} as const

export function getMembershipTier(tierId: MembershipTierId) {
  return MEMBERSHIP_TIERS[tierId]
}
