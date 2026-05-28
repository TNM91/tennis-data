export type CoachAssignmentTemplate = {
  id: string
  title: string
  focus: string
  detail: string
  assignment: {
    reps?: number
    sets?: number
    tracker: string[]
    playerPlusPrompt: string
  }
}

export const COACH_ASSIGNMENT_TEMPLATES: CoachAssignmentTemplate[] = [
  {
    id: 'serve-target-ladder',
    title: 'Serve target ladder',
    focus: 'Serve pressure',
    detail: 'Call wide, body, or T before each serve and track target clarity, not just makes.',
    assignment: {
      reps: 60,
      tracker: ['Target called before toss', 'Made target window', 'Same routine at pressure score'],
      playerPlusPrompt: 'Log the target that held up best under pressure.',
    },
  },
  {
    id: 'split-recover-repeat',
    title: 'Split, recover, repeat',
    focus: 'Movement',
    detail: 'Recover through the center lane after every directional cue and score active feet between shots.',
    assignment: {
      sets: 4,
      tracker: ['Split before cue', 'Balanced first step', 'Recovery before watching result'],
      playerPlusPrompt: 'Add one note on when your feet got quiet.',
    },
  },
  {
    id: 'attack-decision-audit',
    title: 'Attack decision audit',
    focus: 'Shot selection',
    detail: 'Classify build, neutral, attack, or reset before accelerating on the ball.',
    assignment: {
      sets: 3,
      tracker: ['Correct ball call', 'Balanced attack', 'Reset chosen instead of forced attack'],
      playerPlusPrompt: 'Save one point where restraint prevented an error.',
    },
  },
  {
    id: 'doubles-first-move',
    title: 'Doubles first move',
    focus: 'Doubles IQ',
    detail: 'Call the serve pattern and first partner movement before the point starts.',
    assignment: {
      sets: 2,
      tracker: ['Serve location called', 'Partner first move', 'Middle ball owned'],
      playerPlusPrompt: 'Bring one partner cue to the next coach note.',
    },
  },
]

export function getCoachAssignmentTemplate(templateId: string) {
  return COACH_ASSIGNMENT_TEMPLATES.find((template) => template.id === templateId) ?? COACH_ASSIGNMENT_TEMPLATES[0]
}
