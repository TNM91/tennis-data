import type { TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { COACH_TACTICS_BOARD_HREF } from './tactics-hrefs'
import { getPlayerDevelopmentIdentity } from './player-development'

export { COACH_TACTICS_BOARD_HREF } from './tactics-hrefs'

export type CoachWorkspaceCommand = {
  title: string
  detail: string
  href: string
  cta: string
  icon: TiqFeatureIconName
}

export type CoachStudentSnapshot = {
  id: string
  name: string
  identitySlug: string
  identity: string
  level: string
  nextStep: string
  status: 'Needs assignment' | 'On track' | 'Review notes'
}

export type CoachLessonBlock = {
  minutes: string
  title: string
  detail: string
}

export type CoachIntegrationStep = {
  label: string
  value: string
}

export type CoachSessionPreset = {
  id: string
  title: string
  bestFor: string
  objective: string
  drill: string
  pressureGame: string
  playerPlusPrompt: string
}

export const COACH_WORKSPACE_COMMANDS: CoachWorkspaceCommand[] = [
  {
    title: 'Build lesson plan',
    detail: 'Use a 60-minute structure: warmup, technical block, live-ball block, pressure game, assignment.',
    href: '/player-development/relentless-competitor-4-0/coach-planner',
    cta: 'Open planner',
    icon: 'reports',
  },
  {
    title: 'Map the drill',
    detail: 'Create reusable court boards, paths, zones, and coaching cues in TIQ Tactical Studio.',
    href: COACH_TACTICS_BOARD_HREF,
    cta: 'Open tactics',
    icon: 'scenarioBuilder',
  },
  {
    title: 'Assign homework',
    detail: 'Turn the lesson into player-ready practice, match, and accountability assignments.',
    href: '/messages?compose=direct&subject=Coach%20assignment%20follow-up&body=Here%27s%20the%20assignment%20from%20today%27s%20lesson%3A%20',
    cta: 'Draft assignment',
    icon: 'messagingCenter',
  },
  {
    title: 'Review court video',
    detail: 'Open serve, stroke, and footwork clips with timestamped notes, lines, arrows, and circles.',
    href: '/video-review?mode=coach',
    cta: 'Open video queue',
    icon: 'reports',
  },
  {
    title: 'Schedule next session',
    detail: 'Keep lesson date, site, focus, and follow-up together with the player workflow.',
    href: '/messages?compose=direct&subject=Next%20lesson%20schedule&body=Let%27s%20confirm%20the%20next%20lesson.%20Date%2Ftime%3A%20%20Site%3A%20%20Focus%3A%20',
    cta: 'Schedule lesson',
    icon: 'schedule',
  },
]

export const COACH_LESSON_BLOCKS: CoachLessonBlock[] = [
  {
    minutes: '0-8',
    title: 'Ready body',
    detail: 'Movement prep, hand rhythm, and live split-step timing.',
  },
  {
    minutes: '8-22',
    title: 'Skill focus',
    detail: 'One technical constraint with high-quality reps and clear feedback.',
  },
  {
    minutes: '22-42',
    title: 'Pattern work',
    detail: 'Use the tactical board to connect the shot to court position.',
  },
  {
    minutes: '42-55',
    title: 'Pressure game',
    detail: 'Score it, constrain it, and make the player compete under fatigue.',
  },
  {
    minutes: '55-60',
    title: 'Assignment',
    detail: 'Name the exact habit, target, and tracking method before the player leaves.',
  },
]

export const COACH_SESSION_PRESETS: CoachSessionPreset[] = [
  {
    id: 'serve-plus-one-pressure',
    title: 'Serve plus one pressure',
    bestFor: 'Player who needs a repeatable first pattern under score pressure.',
    objective: 'Land the serve target, recover on balance, and choose the correct first ball.',
    drill: 'Three-ball sequence: serve to called target, recover, first ball through the high-percentage window.',
    pressureGame: 'First to seven points. Double value when the serve target and first-ball decision both match the plan.',
    playerPlusPrompt: 'Log target %, first-ball decision, and one score-pressure note after the session.',
  },
  {
    id: 'relentless-movement-repeat',
    title: 'Relentless movement repeat',
    bestFor: 'Player who competes hard but loses spacing or recovery shape late.',
    objective: 'Stay in motion between shots, split on opponent contact, and recover without panic.',
    drill: 'Live-ball movement chain: defend wide, recover middle, attack the short ball, reset.',
    pressureGame: 'Ten-ball survival game. Point only counts when recovery position is clean before the next feed.',
    playerPlusPrompt: 'Save three fatigue cues: footwork, breathing, and decision quality after eight-plus ball points.',
  },
  {
    id: 'attackable-ball-filter',
    title: 'Attackable ball filter',
    bestFor: 'Player who over-attacks neutral balls or misses the right short-ball moment.',
    objective: 'Separate neutral, build, and attack balls before changing direction.',
    drill: 'Coach feeds mixed depth. Player calls neutral, build, or attack before contact and executes the matching target.',
    pressureGame: 'Green-light game. Earn one point for the right call, one for the right target, one for recovery.',
    playerPlusPrompt: 'Track three examples where the player waited, built, then attacked the correct ball.',
  },
]

export const COACH_INTEGRATION_STEPS: CoachIntegrationStep[] = [
  { label: 'Player link', value: 'Assignments and check-ins' },
  { label: 'Coach', value: 'Lesson planning and tracking' },
  { label: 'Captain', value: 'Team lineups and match week' },
  { label: 'Full-Court', value: 'Lessons, teams, leagues, and events' },
]

export function buildCoachStudentSnapshots(): CoachStudentSnapshot[] {
  const relentless = getPlayerDevelopmentIdentity('relentless-competitor-4-0')
  const attacker = getPlayerDevelopmentIdentity('smart-attacker-4-0-to-4-5')

  return [
    {
      id: 'demo-relentless-competitor',
      name: 'Player A',
      identitySlug: relentless.slug,
      identity: relentless.title,
      level: relentless.levelPath.context,
      nextStep: 'Second-serve targets plus first-ball recovery.',
      status: 'Needs assignment',
    },
    {
      id: 'demo-smart-attacker',
      name: 'Player B',
      identitySlug: attacker.slug,
      identity: attacker.title,
      level: attacker.levelPath.context,
      nextStep: 'Attackable-ball decision ladder and earned direction changes.',
      status: 'On track',
    },
    {
      id: 'demo-doubles-connector',
      name: 'Player C',
      identitySlug: relentless.slug,
      identity: 'Doubles Connector',
      level: 'Competitive doubles development path.',
      nextStep: 'Return position, net-player movement, and middle ownership.',
      status: 'Review notes',
    },
  ]
}

export function getCoachPlannerHref(identitySlug: string) {
  return `/player-development/${identitySlug}/coach-planner`
}

export function getCoachSessionPreset(id: string) {
  return COACH_SESSION_PRESETS.find((preset) => preset.id === id) ?? COACH_SESSION_PRESETS[0]
}

export function buildSessionPresetAssignment(presetId: string) {
  const preset = getCoachSessionPreset(presetId)
  return {
    title: preset.title,
    focus: preset.objective,
    detail: `${preset.drill} ${preset.pressureGame}`,
    tracker: [
      'Objective completed with clear scoring standard',
      'Pressure game result recorded',
      'Player prompt answered before next session',
    ],
    prompt: preset.playerPlusPrompt,
  }
}
