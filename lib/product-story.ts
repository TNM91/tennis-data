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
    shortPromise: 'Run the season from one place.',
    audience: 'League coordinators and admins running players or teams',
    upgradeCue: 'Give coordinators and members one place for requests, schedules, results, and standings.',
    description:
      'Run leagues of players or teams with one home for participation, scheduling, results, standings, visibility, and admin workflows.',
    valueProps: [
      'Approve teams or players before they enter the season',
      'Keep schedules, sites, and match details in one league home',
      'Turn results into standings without spreadsheet cleanup',
      'Give members a clear place to know who, when, where, and what happened',
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
    primaryCta: { label: 'Unlock Player', href: '/pricing#player_plus' },
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
    primaryCta: { label: 'Unlock Captain Tools', href: '/pricing#captain' },
    secondaryCta: { label: 'See Captain tools', href: '/captain' },
    featuredNote: 'Best for captains who want fewer scattered texts and clearer weekly decisions.',
  },
  league: {
    stage: 'Coordinator unlock',
    headline: 'Run the season from one place.',
    copy: 'Manage approvals, schedules, results, standings, and league visibility so coordinators and members spend less time chasing details.',
    bullets: [
      'Approve players or teams before they enter',
      'Keep schedule and site details visible',
      'Turn match results into standings',
    ],
    primaryCta: { label: 'Run Your League on TIQ', href: '/pricing#league' },
    secondaryCta: { label: 'Explore Leagues', href: '/explore/leagues' },
  },
}

export const HOME_HERO_STORY = {
  eyebrow: 'Premium tennis intelligence',
  badge: 'Built by role',
  kicker: 'Choose the tennis job you need solved.',
  headlineTop: 'Tennis decisions,',
  headlineBottom: 'made clearer.',
  body:
    'Start free. Upgrade when you need your lab, your lineup, or your league.',
  proof: ['Free search', 'Player insight', 'Captain decisions', 'League operations'],
} as const

export const MY_LAB_STORY = {
  eyebrow: 'Player home base',
  headline: 'Welcome to your tennis lab.',
  body:
    'See where you are, how you are playing, what to work on next, and who makes sense to play.',
  railKicker: 'Your home base',
  railTitle: 'Built around you',
  upgradeHeadline: 'Make My Lab yours',
  upgradeBody:
    'Player unlocks a profile-linked home base with self-analysis, matchup prep, who-to-play-next context, and follows for fun.',
  upgradeCta: 'Unlock My Lab with Player',
  upgradeSecondary: 'See Player plan',
  upgradeFootnote: 'Best for players who want smarter match prep and one home for their tennis.',
  workspaceProof: [
    {
      label: 'Identity',
      title: 'Your player record stays connected.',
      body: 'Ratings, recent decisions, teams, and useful context start from one linked profile.',
    },
    {
      label: 'Prep',
      title: 'Matchup reads stay one tap away.',
      body: 'Use the scorecard to decide who to compare, what changed, and what to watch next.',
    },
    {
      label: 'Action',
      title: 'The lab ends with a tennis move.',
      body: 'Pick one focus, follow the right context, then get back to playing with a clearer plan.',
    },
  ],
} as const

export const MATCHUP_STORY = {
  eyebrow: 'Player unlock',
  headline: 'Choose. Compare. Play smarter.',
  body:
    'Pick the court, choose the players, and get the read before match time.',
  upgradeHeadline: 'Unlock Matchup with Player',
  upgradeBody:
    'Player unlocks Matchup, My Lab, follows, and player-linked prep so your tennis context follows you from scouting to match day.',
  upgradeCta: 'Unlock Matchup with Player',
  upgradeSecondary: 'See Player plan',
  upgradeFootnote: 'Best for players who want less guessing before the next match.',
  proof: ['Edge', 'Why it leans', 'What to watch'],
  readoutTitle: 'Use Matchup as a quick prep read.',
  readoutBody:
    'Start with the edge, then check the rating gap, confidence, form, and head-to-head context before you decide how much to trust it.',
} as const

export const CAPTAIN_STORY = {
  eyebrow: 'Captain unlock',
  headline: 'Run the week without chasing answers.',
  body:
    'See who can play, build the lineup, test the choice, and send the plan from one captain workspace.',
  quickStartKicker: 'Captain weekly flow',
  quickStartTitle: 'Four steps to match day',
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
  workspaceProof: [
    {
      label: 'Readiness',
      title: 'Know what is blocking the week.',
      body: 'Availability, match context, lineup, messaging, and brief status stay visible before match day.',
    },
    {
      label: 'Decision',
      title: 'Move from choices to a lineup.',
      body: 'Projection, builder, and scenario tools help captains compare the team shape before sending it.',
    },
    {
      label: 'Send',
      title: 'Close the loop with the team.',
      body: 'Weekly notes, player replies, and captain briefs keep the plan in one place.',
    },
  ],
  workflow: [
    ['1', 'Know who can play', 'Confirm availability and response risk before lineup pressure starts.'],
    ['2', 'Build your lineup', 'Turn the player pool into the strongest weekly shape.'],
    ['3', 'Test the alternatives', 'Compare scenarios before you commit.'],
    ['4', 'Send the plan', 'Share lineup, logistics, reminders, and follow-ups.'],
  ],
} as const

export const LEAGUE_COORDINATOR_STORY = {
  eyebrow: 'TIQ League Coordinator unlock',
  headline: 'Run the season from one place.',
  body:
    'Approve entries, set the schedule shape, collect results, and keep standings moving so everyone can focus on playing.',
  subnavTitle: 'League Coordinator',
  subnavDescription:
    'Manage league operations separately from weekly captain tools.',
  newLeagueTitle: 'Create league setup',
  newLeagueBody:
    'Choose team or individual format, name the season, set visibility, then approve participants.',
  upgradeHeadline: 'Ready to run organized competition without spreadsheets?',
  upgradeBody:
    'TIQ League Coordinator gives organizers one operating home for approvals, schedules, results, standings, and member clarity.',
  draftUpgradeHeadline: 'Need this draft to become a real league workspace?',
  draftUpgradeBody:
    'TIQ League Coordinator turns setup into a season workspace where requests, scheduling, results, and standings stay together.',
  registryTitle: 'Current TIQ league definitions',
  registryBody:
    'Manage the league records that power approvals, schedules, standings, results, and organizer workflows.',
  finalUpgradeHeadline: 'Ready to run the season without spreadsheet cleanup?',
  finalUpgradeBody:
    'TIQ League Coordinator turns league records into one cleaner system for scheduling, standings, participation, and league-wide clarity.',
  cta: 'Run Your League on TIQ',
} as const

export function getMembershipTier(tierId: MembershipTierId) {
  return MEMBERSHIP_TIERS[tierId]
}
