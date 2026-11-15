import { getNativeAuthStorage } from '../../lib/native-auth-storage'

export const starterQuestions = [
  {
    prompt: 'How steady is your baseline rally?',
    answers: [
      'Learning to rally',
      'Rally at an easy pace',
      'Aim to either side',
      'Control pace & depth',
    ],
    drill: { id: 'wall-rally-rhythm', title: 'Wall Rally Rhythm' },
  },
  {
    prompt: 'How reliable is your serve?',
    answers: [
      'Learning to serve',
      'Serve to both sides',
      'Steady second serve',
      'Place both serves',
    ],
    drill: { id: 'serve-target-call', title: 'Serve Target Call' },
  },
  {
    prompt: 'How do you build a point?',
    answers: [
      'New to playing points',
      'Rally and recover',
      'Defend or attack',
      'Adapt to opponents',
    ],
    drill: { id: '30-30-pressure-game', title: '30–30 Pressure Game' },
  },
] as const

const levels = ['Learning the game', 'Building consistency', 'Match ready', 'Competitive'] as const
type Answer = 0 | 1 | 2 | 3
type StarterAnswers = [Answer, Answer, Answer]

function isAnswer(value: unknown): value is Answer {
  return value === 0 || value === 1 || value === 2 || value === 3
}

export function readStarterAnswers(value: unknown): StarterAnswers | null {
  if (!Array.isArray(value) || value.length !== starterQuestions.length) return null
  const [rally, serve, points] = value
  return isAnswer(rally) && isAnswer(serve) && isAnswer(points) ? [rally, serve, points] : null
}

export function starterResult(answers: StarterAnswers) {
  // Use the middle response for the level and the lowest response for the next drill.
  const [lowest, middle] = [...answers].sort((a, b) => a - b)
  const focus = answers.indexOf(lowest)
  return { level: levels[middle], drill: starterQuestions[focus].drill }
}

export function starterStorage(owner: string) {
  const key = 'starter-tiq:v1:' + owner
  const storage = getNativeAuthStorage() ?? localStorage
  return {
    async read() {
      const saved = await storage.getItem(key)
      if (saved === null) return null
      return readStarterAnswers(JSON.parse(saved))
    },
    async save(answers: StarterAnswers) { await storage.setItem(key, JSON.stringify(answers)) },
    async clear() { await storage.removeItem(key) },
  }
}

export async function clearStarterTiq(owner: string) {
  await starterStorage(owner).clear()
}
