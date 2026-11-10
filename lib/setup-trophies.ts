import { MEMBERSHIP_TIER_ORDER, type MembershipTierId } from './product-story'

const captainTeamSetup = 'Ask your league coordinator to enter your team name and flight in a TenAceIQ season and confirm your captain role. If you run the season, open League Office on the TenAceIQ website, create a team season, and add your team under Participants.'

export const setupSteps = {
  account: { title: 'Verify your account', detail: 'Confirm your email and sign in to TenAceIQ.' },
  scorecard: { title: 'Log your first match', detail: 'In My Lab, tap Log a match and save a scorecard.', action: 'scorecard' },
  practice: { title: 'Save your first practice', detail: 'Open Coach & training → Level Up, pick a drill, then log your practice.', action: 'training' },
  student: { title: 'Add your first student', detail: 'Open Coach Hub, add a student, and save their roster record.', action: 'coach-workspace' },
  assignment: { title: 'Assign a drill', detail: 'Open the student’s record in Coach Hub and save their first assignment.', action: 'coach-workspace' },
  team: { title: 'Connect your team', detail: captainTeamSetup, action: 'chats' },
  invite: { title: 'Create a team invite', detail: 'In Chats, open your team → Team → Invite teammates. Create a link and share it with your players.', action: 'chats' },
  teammate: { title: 'Welcome a teammate', detail: 'Ask a player to use your link in Chats → Join team and accept the invitation.', action: 'chats' },
  season: { title: 'Create a TenAceIQ season', detail: 'On the TenAceIQ website, open League Office, choose Team or Individual, and save your season.' },
  fixture: { title: 'Schedule the first match', detail: 'In League Office, open the season, add your participants, and save a fixture on the Schedule.' },
} as const

export type SetupStep = keyof typeof setupSteps
export type SetupEvidence = Partial<Record<SetupStep, boolean>>
export const setupTracks = {
  free: { award: 'Clubhouse Pass', steps: ['account'] },
  player_plus: { award: 'First Rally', steps: ['scorecard', 'practice'] },
  coach: { award: 'Coach’s First Drill', steps: ['student', 'assignment'] },
  captain: { award: 'Team Rally', steps: ['team', 'invite', 'teammate'] },
  league: { award: 'Opening Match', steps: ['season', 'fixture'] },
  full_court: { award: 'Full-Court Starter', steps: ['scorecard', 'practice', 'student', 'assignment', 'team', 'invite', 'teammate', 'season', 'fixture'] },
} as const satisfies Record<MembershipTierId, { award: string; steps: readonly SetupStep[] }>

export type SetupTrack = { tier: MembershipTierId; done: SetupStep[] }

export function buildSetupTracks(tiers: readonly MembershipTierId[], evidence: SetupEvidence): SetupTrack[] {
  return MEMBERSHIP_TIER_ORDER.filter(tier => tiers.includes(tier)).map(tier => ({
    tier, done: setupTracks[tier].steps.filter(step => evidence[step] === true),
  }))
}

export function readSetupTracks(value: unknown): SetupTrack[] {
  if (!Array.isArray(value) || value.length > MEMBERSHIP_TIER_ORDER.length) throw Error('Setup progress unavailable')
  const seen = new Set<MembershipTierId>()
  return value.map(track => {
    if (!track || !MEMBERSHIP_TIER_ORDER.includes(track.tier) || seen.has(track.tier)) throw Error('Invalid setup track')
    const tier = track.tier as MembershipTierId
    const steps: readonly SetupStep[] = setupTracks[tier].steps
    if (!Array.isArray(track.done) || new Set(track.done).size !== track.done.length ||
        track.done.some((step: SetupStep) => !steps.includes(step))) throw Error('Invalid setup steps')
    seen.add(tier)
    return { tier, done: steps.filter(step => track.done.includes(step)) }
  })
}
