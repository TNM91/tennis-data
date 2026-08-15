import type { PricingPlanId } from './pricing-plans'

export type ProductTourVideoId =
  | 'teaser'
  | 'platform-tour'
  | 'free'
  | 'player'
  | 'coach'
  | 'captain'
  | 'league'
  | 'full-court'
  | 'club'

export type ProductTourVideo = {
  id: ProductTourVideoId
  eyebrow: string
  title: string
  description: string
  durationLabel: string
  durationSeconds: number
  src: string
  captions: string
  poster: string
  transcript: readonly string[]
  cta: {
    label: string
    href: string
  }
}

const mediaPath = '/media/product-tours'

export const PRODUCT_TOUR_VIDEOS: Record<ProductTourVideoId, ProductTourVideo> = {
  teaser: {
    id: 'teaser',
    eyebrow: '16-second preview',
    title: 'See what TenAceIQ brings together.',
    description: 'A quick look at the connected path from free tennis search to Player, Coach, Captain, League, Full-Court, and Club tools.',
    durationLabel: '16 seconds',
    durationSeconds: 16,
    src: `${mediaPath}/teaser.mp4`,
    captions: `${mediaPath}/teaser.vtt`,
    poster: `${mediaPath}/teaser-poster.jpg`,
    transcript: [
      'What if every tennis decision felt clearer?',
      'Start free. Add the role you need, from Player to Club.',
      'One connected platform to play, improve, lead, and organize.',
      'TenAceIQ. More tennis. Less chaos.',
    ],
    cta: { label: 'Watch the full tour', href: '/resources/platform-tour' },
  },
  'platform-tour': {
    id: 'platform-tour',
    eyebrow: 'Complete platform tour',
    title: 'Find the TenAceIQ path that fits your tennis life.',
    description: 'See how TenAceIQ supports players, coaches, captains, organizers, and clubs without adding more tennis chaos.',
    durationLabel: '1 minute, 25 seconds',
    durationSeconds: 85,
    src: `${mediaPath}/platform-tour.mp4`,
    captions: `${mediaPath}/platform-tour.vtt`,
    poster: `${mediaPath}/platform-tour-poster.jpg`,
    transcript: [
      'Tennis already gives you enough to think about. TenAceIQ helps make the next decision a whole lot clearer.',
      'You can start free, then choose the tools that fit your tennis life: Player, Coach, Captain, League, Full-Court, or Club.',
      'Need an answer? Explore players, teams, leagues, rankings, and tournaments in one place.',
      'When it is your game, Player brings everything together in My Lab, with matchup prep, Level Up, and tactics tools built around you.',
      'If you are coaching, plan the lesson, assign the next piece of work, review progress, and keep every player moving between sessions.',
      'Captaining a team? See who is ready, compare lineups, scout the matchup, and send one plan everyone understands.',
      'Running a league or tournament? Manage schedules, scores, standings, and events without turning every update into spreadsheet cleanup.',
      'Wearing more than one hat? Full-Court keeps your player, coach, captain, and organizer tools connected.',
      'Running a club? Bring staff, players, programs, teams, leagues, and tournaments into one branded, connected experience.',
      'And when members share trusted uploads, Data Assist keeps results, rosters, and schedules current. Every contribution makes TenAceIQ more useful for the entire tennis community.',
      'Start free. Add only what helps. TenAceIQ. More tennis. Less chaos.',
    ],
    cta: { label: 'See plans', href: '/pricing' },
  },
  free: {
    id: 'free',
    eyebrow: 'Free quick view',
    title: 'Search tennis in one place.',
    description: 'Explore players, teams, leagues, rankings, coaches, tournaments, and public tennis context before choosing paid tools.',
    durationLabel: '18 seconds',
    durationSeconds: 18,
    src: `${mediaPath}/free.mp4`,
    captions: `${mediaPath}/free.vtt`,
    poster: `${mediaPath}/free-poster.jpg`,
    transcript: [
      'Start with Free when you want the whole tennis world in one clear view.',
      'Search players, teams, leagues, rankings, coaches, and tournaments, then use public context to understand what you are seeing.',
      'Free gives you useful answers now, and a clear place to decide what to unlock next.',
    ],
    cta: { label: 'Start exploring', href: '/explore' },
  },
  player: {
    id: 'player',
    eyebrow: 'Player quick view',
    title: 'Make TenAceIQ personal to your game.',
    description: 'Bring My Lab, matchup preparation, Level Up work, and tactics together around the player you are becoming.',
    durationLabel: '20 seconds',
    durationSeconds: 20,
    src: `${mediaPath}/player.mp4`,
    captions: `${mediaPath}/player.vtt`,
    poster: `${mediaPath}/player-poster.jpg`,
    transcript: [
      'Player is where your tennis becomes personal, with one home for the information that helps your game.',
      'Use My Lab, prepare for matchups, follow your Level Up work, and keep tactics connected to the player you are becoming.',
      'Instead of staring at match history, leave with a clearer next move for practice and competition.',
    ],
    cta: { label: 'See Player', href: '/pricing#player_plus' },
  },
  coach: {
    id: 'coach',
    eyebrow: 'Coach quick view',
    title: 'Give every player a clearer next step.',
    description: 'Plan lessons, assign court work, review player proof, and keep development moving between sessions.',
    durationLabel: '19 seconds',
    durationSeconds: 19,
    src: `${mediaPath}/coach.mp4`,
    captions: `${mediaPath}/coach.vtt`,
    poster: `${mediaPath}/coach-poster.jpg`,
    transcript: [
      'Coach helps you keep player development moving between lessons, not just while you are on court.',
      'Plan the lesson, assign the next piece of work, review player proof, and track progress in one connected coaching path.',
      'Give every player a clearer next step, while keeping your follow-up organized and easy to act on.',
    ],
    cta: { label: 'See Coach', href: '/pricing#coach' },
  },
  captain: {
    id: 'captain',
    eyebrow: 'Captain quick view',
    title: 'Make match-week decisions with clarity.',
    description: 'See readiness, compare lineups, scout the matchup, and send one plan your players can understand.',
    durationLabel: '18 seconds',
    durationSeconds: 18,
    src: `${mediaPath}/captain.mp4`,
    captions: `${mediaPath}/captain.vtt`,
    poster: `${mediaPath}/captain-poster.jpg`,
    transcript: [
      'Captain brings the entire match week into one trusted team workflow.',
      'See who is ready, compare lineup scenarios, scout the matchup, and send a plan your players can understand.',
      'Spend less time chasing answers in group texts, and more time making the team decision with confidence.',
    ],
    cta: { label: 'See Captain', href: '/pricing#captain' },
  },
  league: {
    id: 'league',
    eyebrow: 'League quick view',
    title: 'Run competition with less cleanup.',
    description: 'Build schedules, collect scores, maintain standings, and keep season updates easier for everyone to follow.',
    durationLabel: '19 seconds',
    durationSeconds: 19,
    src: `${mediaPath}/league.mp4`,
    captions: `${mediaPath}/league.vtt`,
    poster: `${mediaPath}/league-poster.jpg`,
    transcript: [
      'League gives organizers one competition home for the season in front of them.',
      'Build schedules, collect scores, maintain standings, and connect league or tournament updates without another cleanup cycle.',
      'Move the competition forward with structure that players, captains, and organizers can follow.',
    ],
    cta: { label: 'See League', href: '/pricing#league' },
  },
  'full-court': {
    id: 'full-court',
    eyebrow: 'Full-Court quick view',
    title: 'Keep every tennis role connected.',
    description: 'Move between Player, Coach, Captain, League, and Tournament Desk tools without rebuilding your context.',
    durationLabel: '17 seconds',
    durationSeconds: 17,
    src: `${mediaPath}/full-court.mp4`,
    captions: `${mediaPath}/full-court.vtt`,
    poster: `${mediaPath}/full-court-poster.jpg`,
    transcript: [
      'Full-Court is for the tennis person who wears more than one hat.',
      'Keep Player, Coach, Captain, League, and Tournament Desk tools connected to the same tennis identity and trusted data.',
      'Move between roles without rebuilding the context you already created somewhere else.',
    ],
    cta: { label: 'See Full-Court', href: '/pricing#full_court' },
  },
  club: {
    id: 'club',
    eyebrow: 'Club quick view',
    title: 'Give the club one connected tennis experience.',
    description: 'Connect staff, coaches, players, programs, teams, leagues, and events under the club brand.',
    durationLabel: '22 seconds',
    durationSeconds: 22,
    src: `${mediaPath}/club.mp4`,
    captions: `${mediaPath}/club.vtt`,
    poster: `${mediaPath}/club-poster.jpg`,
    transcript: [
      'Club connects the people, programs, teams, and competition that make your tennis organization work.',
      'Start with one location, or scale across locations with connected staff, coaches, players, programs, leagues, and events.',
      'Deliver one branded club experience, with the structure to grow without adding more disconnected systems.',
    ],
    cta: { label: 'See Club plans', href: '/pricing#club-plans' },
  },
}

export const PRICING_PLAN_VIDEO_IDS: Record<PricingPlanId, ProductTourVideoId> = {
  free: 'free',
  player_plus: 'player',
  coach: 'coach',
  captain: 'captain',
  league: 'league',
  full_court: 'full-court',
}

export const TIER_TOUR_VIDEO_IDS: ProductTourVideoId[] = [
  'free',
  'player',
  'coach',
  'captain',
  'league',
  'full-court',
  'club',
]
