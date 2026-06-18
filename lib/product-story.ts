export const PRODUCT_NORTH_STAR =
  'TenAceIQ helps players, captains, coaches, leagues, and tournaments spend less time managing, guessing, searching, and coordinating, and more time improving, competing, coaching, leading, and playing.'

export const PRODUCT_MOTTO = 'More Tennis. Less Chaos.'

export const PLATFORM_POSITIONING =
  'The tennis platform that helps players, captains, coaches, leagues, and tournaments improve, compete, and manage the game with less friction.'

export const PLATFORM_MISSION =
  'Help the tennis community spend less time managing tennis and more time playing, improving, and enjoying it.'

export const PLATFORM_PILLARS = [
  {
    id: 'improve',
    title: 'Improve',
    promise: 'Know what to work on next.',
    body:
      'Use player development paths, ratings, progress signals, drills, skills, strategy, coach connection, and training resources to turn guesswork into focused court work.',
    href: '/player-development',
    cta: 'Level Up My Game',
    proof: ['Player development', 'Drills and skills', 'Coach connection'],
  },
  {
    id: 'compete',
    title: 'Compete',
    promise: 'Prepare for the matchup in front of you.',
    body:
      'Use matchup insight, scouting, lineup strategy, match preparation, performance tracking, and player or team intelligence to compete with a clearer plan.',
    href: '/compete',
    cta: 'Prepare to Compete',
    proof: ['Matchup insight', 'Scouting', 'Performance tracking'],
  },
  {
    id: 'manage',
    title: 'Manage',
    promise: 'Keep teams, leagues, and events organized.',
    body:
      'Use captain tools, scheduling, availability, communication, league setup, tournament setup, score tracking, rosters, and match organization to reduce admin work.',
    href: '/manage',
    cta: 'Manage My Team',
    proof: ['Availability', 'Schedules and scores', 'Roster organization'],
  },
] as const

export const PLATFORM_AUDIENCE_PATHS = [
  {
    audience: 'Players',
    question: 'What should I work on, how am I improving, and what matchup matters next?',
    href: '/mylab',
    cta: 'Find Player Insights',
  },
  {
    audience: 'Captains',
    question: 'Who is available, what lineup gives us the best chance, and what needs to be sent?',
    href: '/captain',
    cta: 'Manage My Team',
  },
  {
    audience: 'Coaches',
    question: 'What should I assign, how is the player developing, and what should happen between sessions?',
    href: '/coaches',
    cta: 'Support Players',
  },
  {
    audience: 'Leagues and tournaments',
    question: 'How do we organize schedules, teams, players, scores, and results with less admin work?',
    href: '/leagues-and-tournaments',
    cta: 'Run a League or Tournament',
  },
] as const

export const PRODUCT_UPGRADE_MESSAGE =
  'Upgrade based on what makes your tennis life easier: simple tiers, clear workspaces, clearer next steps.'

export const PRODUCT_PRINCIPLES = [
  'Simple tiers',
  'Clear upgrade value',
  'Tennis-specific intelligence',
  'User-uploaded Data Assist refreshes',
  'Practical workspaces over generic dashboards',
  'Personalized insight for players',
  'Connected development workflows for coaches',
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
  'Promises that imply direct USTA API dependence',
] as const

export const DATA_ASSIST_STORY = {
  eyebrow: 'Data Assist',
  headline: 'Keep tennis context current with trusted uploads.',
  body:
    'TenAceIQ uses player, captain, coordinator, and admin uploads instead of relying on a direct USTA API. Upload TennisLink exports for scorecards, schedules, and team summaries, then review before they shape platform intelligence.',
  shortCue: 'Upload TennisLink exports through Data Assist when results, schedules, or rosters need to refresh.',
  cta: 'Open Data Assist',
  href: '/data-assist?intent=upload-source&context=Product%20story',
  proof: [
    'Scorecard uploads refresh match history',
    'Schedule uploads power weekly planning',
    'Team summaries improve roster context',
    'Review keeps imported data trustworthy',
  ],
} as const

export type MembershipTierId = 'free' | 'player_plus' | 'coach' | 'captain' | 'league' | 'full_court'

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
    shortPromise: 'Find the tennis landscape.',
    audience: 'Players, captains, and fans getting oriented',
    upgradeCue: 'Start with public tennis intelligence.',
    description:
      'Find players, leagues, teams, rankings, and public tennis intelligence before you need a personal workspace.',
    valueProps: [
      'Search players, teams, leagues, and rankings',
      'View public tennis context',
      'Contribute TennisLink exports through Data Assist',
      'Understand the landscape before upgrading',
    ],
  },
  player_plus: {
    id: 'player_plus',
    name: 'Player',
    shortPromise: 'Personalize TenAceIQ around your game.',
    audience: 'Players who want clearer prep and a personalized tennis home',
    upgradeCue: 'Unlock My Lab, Level Up, data refreshes, matchups, and messages.',
    description:
      'Unlock My Lab, Level Up training cards, Tactics Tools, refreshed tennis context, matchup prep, and tennis messages together.',
    valueProps: [
      'Unlock My Lab',
      'Use Level Up cards and Tactics Tools to improve your game',
      'Improve the data behind your tennis read',
      'Prep matchups before you play',
      'Review tennis messages in one place',
    ],
  },
  coach: {
    id: 'coach',
    name: 'Coach',
    shortPromise: 'Give every player the next useful step.',
    audience: 'Private coaches, school coaches, and training-group leaders',
    upgradeCue: 'Unlock lesson planning, drill assignments, player development tracking, scheduling, and coach-player communication.',
    description:
      'Use Player features plus Coach Hub to assign drills, track player development, recommend resources, schedule lessons, review proof, and support players between sessions.',
    valueProps: [
      'Plan lessons and practice blocks',
      'Track player development and training groups',
      'Assign drills, proof, and next steps',
      'Use TIQ Tactical Studio for drill boards',
      'Communicate with Player students',
    ],
  },
  captain: {
    id: 'captain',
    name: 'Captain',
    shortPromise: 'Make team decisions with more clarity.',
    audience: 'Captains managing lineups, readiness, and weekly decisions',
    upgradeCue: 'Add Team Hub and Captain Tools on top of Player.',
    description:
      'Use Player features plus Team Hub and Captain Tools for lineups, scouting, team decisions, player readiness, and weekly team flow.',
    valueProps: [
      'Build and compare lineups',
      'Scout players and teams',
      'Track availability and readiness',
      'Use Data Assist uploads to keep match-week context fresh',
      'Make weekly team decisions with less guesswork',
    ],
  },
  league: {
    id: 'league',
    name: 'League',
    shortPromise: 'Run competition with less admin work.',
    audience: 'League coordinators and organizers running one competition workspace',
    upgradeCue: 'Give members one place for requests, schedules, players or teams, scores, and standings.',
    description:
      'Run one league, ladder, or tournament workspace with player or team setup, scheduling, score tracking, standings, visibility, and admin workflows.',
    valueProps: [
      'Approve teams or players before they enter the season',
      'Keep schedules, sites, and match details in one league home',
      'Use Data Assist uploads for schedules, rosters, and official scorecards',
      'Turn results into standings without spreadsheet cleanup',
      'Give members a clear place to know who, when, where, and what happened',
    ],
  },
  full_court: {
    id: 'full_court',
    name: 'Full-Court',
    shortPromise: 'Run every tennis job.',
    audience: 'Coaches, captains, clubs, and organizers running more than one tennis job',
    upgradeCue: 'Unlock My Lab, Coach Hub, Team Hub, League Office, and unlimited Tournament Desk operations.',
    description:
      'Use My Lab, Coach Hub, Team Hub, League Office, ladders, and unlimited Tournament Desk operations as one connected tennis operation.',
    valueProps: [
      'My Lab, Coach Hub, Team Hub, and League Office together',
      'Unlimited Tournament Desk and event workspaces',
      'Shared scheduling, results, standings, and rankings',
      'Team and player books across the connected operation',
      'One connected tennis operation for coaches, captains, coordinators, and organizers',
    ],
  },
} as const

export const MEMBERSHIP_TIER_ORDER: MembershipTierId[] = ['free', 'player_plus', 'coach', 'captain', 'league', 'full_court']

export const PRODUCT_PROOF_POINTS = [
  'Less guessing',
  'Clearer match prep',
  'Better player development',
  'Smarter team decisions',
  'Cleaner league operations',
] as const

export type ProductModeId = 'find' | 'you' | 'coach' | 'prep' | 'team' | 'league' | 'plans'

export type ProductModeLanguage = {
  id: ProductModeId
  label: string
  route: string
  planId: MembershipTierId | null
  job: string
  cue: string
}

export const PRODUCT_MODE_LANGUAGE: Record<ProductModeId, ProductModeLanguage> = {
  find: {
    id: 'find',
    label: 'Explore',
    route: '/explore',
    planId: 'free',
    job: 'Find public tennis context',
    cue: 'Search players, teams, leagues, and rankings before you need a paid workspace.',
  },
  you: {
    id: 'you',
    label: 'My Lab',
    route: '/mylab',
    planId: 'player_plus',
    job: 'Make TenAceIQ personal',
    cue: 'Unlock My Lab, data refreshes, matchup prep, and tennis messages.',
  },
  coach: {
    id: 'coach',
    label: 'Coach',
    route: '/coach',
    planId: 'coach',
    job: 'Develop players between lessons',
    cue: 'Assign drills, track development, review check-ins, recommend resources, and keep coach-player communication tied to goals.',
  },
  prep: {
    id: 'prep',
    label: 'Prep',
    route: '/matchup',
    planId: 'player_plus',
    job: 'Prepare for the next match',
    cue: 'Compare the matchup, read the edge, and know what to watch.',
  },
  team: {
    id: 'team',
    label: 'Team',
    route: '/captain',
    planId: 'captain',
    job: 'Lead the team week',
    cue: 'Use lineup, readiness, scouting, messaging, and briefs in one flow.',
  },
  league: {
    id: 'league',
    label: 'Leagues',
    route: '/league-coordinator',
    planId: 'league',
    job: 'Run the season',
    cue: 'Manage structure, schedules, results, standings, and visibility from one place.',
  },
  plans: {
    id: 'plans',
    label: 'Pricing',
    route: '/pricing',
    planId: null,
    job: 'Choose the right unlock',
    cue: 'Start free, then activate My Lab, Coach Hub, Team Hub, League Office, or Full-Court when that role saves time.',
  },
} as const

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
    headline: 'Start free. Find the tennis landscape.',
    copy: 'Search players, teams, leagues, rankings, flights, and areas before you need a personal workspace.',
    bullets: [
      'Search players, teams, leagues, and rankings',
      'Find public tennis context fast',
      'Understand the landscape before upgrading',
    ],
    primaryCta: { label: 'Get Started Free', href: '/join' },
    secondaryCta: { label: 'Open Find', href: '/explore' },
  },
  player_plus: {
    stage: 'Player unlock',
    headline: 'Make TenAceIQ personal.',
    copy: 'Unlock My Lab, improve the data behind your tennis read, prep matchups, and keep messages together.',
    bullets: [
      'Make My Lab your tennis home',
      'Use Level Up to choose and track focused court work',
      'Refresh player and match context',
      'Prep matchups before you play',
    ],
    primaryCta: { label: 'Unlock Player', href: '/pricing#player_plus' },
    secondaryCta: { label: 'Open My Lab', href: '/mylab' },
  },
  coach: {
    stage: 'Coach unlock',
    headline: 'Help players leave with the next step.',
    copy: 'Use Coach Hub to assign drills, track development, recommend resources, schedule sessions, and support players between lessons.',
    bullets: [
      'Build lesson plans and drill assignments',
      'Track player development and review proof',
      'Use TIQ Tactical Studio for practical court work',
    ],
    primaryCta: { label: 'Unlock Coach', href: '/pricing#coach' },
    secondaryCta: { label: 'Open Tactical Studio', href: '/tactics' },
    featuredNote: 'Best for coaches who teach players, groups, clinics, or school practices.',
  },
  captain: {
    stage: 'Captain unlock',
    headline: 'Run match week with less chaos.',
    copy: 'Use Player features plus Team Hub and Captain Tools for availability, lineup strategy, pairings, scouting, and weekly team decisions.',
    bullets: [
      'Build lineups with less guesswork',
      'See who is available and who should play together',
      'Send clear team updates without chasing every thread',
    ],
    primaryCta: { label: 'Unlock Captain', href: '/pricing#captain' },
    secondaryCta: { label: 'Open Captain', href: '/captain' },
    featuredNote: 'Best for captains who want fewer scattered texts and clearer weekly decisions.',
  },
  league: {
    stage: 'League unlock',
    headline: 'Run competition with less admin work.',
    copy: 'Manage players or teams, schedules, scores, standings, and visibility so organizers and members spend less time chasing details.',
    bullets: [
      'Approve players or teams before they enter',
      'Keep schedule and site details visible',
      'Track scores and turn results into standings',
    ],
    primaryCta: { label: 'Unlock League', href: '/pricing#league' },
    secondaryCta: { label: 'Explore Leagues', href: '/explore/leagues' },
  },
  full_court: {
    stage: 'Full-Court unlock',
    headline: 'Run every tennis job.',
    copy: 'Combine My Lab, Coach Hub, Team Hub, League Office, and unlimited Tournament Desk operations so teams, lessons, leagues, ladders, and events stay inside one connected tennis operation.',
    bullets: [
      'Unlock My Lab, Coach Hub, Team Hub, and League Office together',
      'Create unlimited Tournament Desk workspaces',
      'Keep scheduling, results, rankings, and communication connected',
    ],
    primaryCta: { label: 'Unlock Full-Court', href: '/pricing#full_court' },
    secondaryCta: { label: 'Open League Office', href: '/league-coordinator' },
    featuredNote: 'Best for organizers who run more than one tennis job at once.',
  },
}

export const HOME_HERO_STORY = {
  eyebrow: 'Premium tennis intelligence',
  badge: 'Built by role',
  kicker: 'Choose the tennis job you need solved.',
  headlineTop: 'Tennis decisions,',
  headlineBottom: 'made clearer.',
  body:
    'Start free. Upgrade when you need your lab, your coach workflow, your lineup, your league, or every tennis job connected.',
  proof: ['Free search', 'Player insight', 'Coach development', 'Captain decisions', 'Full-Court operations'],
} as const

export const MY_LAB_STORY = {
  eyebrow: 'Player home base',
  headline: 'Welcome to your tennis lab.',
  body:
    'See where you are, how you are playing, what to work on next, and who makes sense to play as uploaded results connect to your profile.',
  railKicker: 'Your home base',
  railTitle: 'Built around you',
  upgradeHeadline: 'Make My Lab yours',
  upgradeBody:
    'Player unlocks a home base with self-analysis, matchup prep, who-to-play-next context, and cleaner tennis messages.',
  upgradeCta: 'Unlock My Lab with Player',
  upgradeSecondary: 'See Player plan',
  upgradeFootnote: 'Best for players who want smarter match prep and one home for their tennis.',
  workspaceProof: [
    {
      label: 'Identity',
      title: 'Your player record stays connected.',
      body: 'Ratings, recent decisions, teams, and useful context start from one set profile.',
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
    'Player unlocks Matchup, My Lab, data refreshes, and messages so your tennis context follows you from scouting to match day.',
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
  headline: 'Run match week with less chaos.',
  body:
    'See who is available, choose the lineup, compare pairings, refresh match context through Data Assist, and send the team plan from one place.',
  quickStartKicker: 'Captain weekly flow',
  quickStartTitle: 'Four steps to match day',
  activeTitle: 'Captain answers the next team question.',
  activeBody:
    'Know who can play, what lineup gives you the best chance, who should play together, and what needs to be sent before match day.',
  upgradeHeadline: 'Still building the week from scattered texts?',
  upgradeBody:
    'Captain brings availability, lineup strategy, pairing context, scouting, readiness, and team messaging into one weekly flow.',
  upgradeResult: 'Spend less time chasing answers and more time sending a lineup you trust.',
  upgradeCta: 'Unlock Captain',
  lockedMessage:
    'Unlock Captain to reduce match-week admin and build clearer team plans.',
  workspaceProof: [
    {
      label: 'Readiness',
      title: 'Know what is blocking the week.',
      body: 'Availability, match context, lineup, messaging, and brief status stay visible before match day.',
    },
    {
      label: 'Decision',
      title: 'Move from choices to a lineup.',
      body: 'Projection, builder, and scenario views help captains compare the team shape before sending it.',
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
  eyebrow: 'League unlock',
  headline: 'Run the season with less admin work.',
  body:
    'Approve players or teams, organize schedules, collect scores, review Data Assist uploads, and keep standings moving so everyone can focus on playing.',
  subnavTitle: 'League Command',
  subnavDescription:
    'Manage league operations separately from the weekly Team workspace, with Data Assist as the upload path for schedules, rosters, and scorecards.',
  newLeagueTitle: 'Create league setup',
  newLeagueBody:
    'Choose team or individual format, name the season, set visibility, then approve participants and prepare the schedule.',
  upgradeHeadline: 'Ready to run organized competition without spreadsheets?',
  upgradeBody:
    'League Office gives organizers one place for participants, schedules, scores, standings, and member clarity.',
  draftUpgradeHeadline: 'Need this draft to become a real League Office workspace?',
  draftUpgradeBody:
    'League Office turns setup into a season workspace where requests, scheduling, results, and standings stay together.',
  registryTitle: 'Current TIQ league definitions',
  registryBody:
    'Manage the league records that power participants, uploaded schedules, score tracking, standings, and organizer workflows.',
  finalUpgradeHeadline: 'Ready to run the season without spreadsheet cleanup?',
  finalUpgradeBody:
    'League Office turns league records into one cleaner system for schedules, participants, scores, standings, and league-wide clarity.',
  cta: 'Unlock League',
} as const

export function getMembershipTier(tierId: MembershipTierId) {
  return MEMBERSHIP_TIERS[tierId]
}
