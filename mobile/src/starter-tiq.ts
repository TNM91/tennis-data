import { isValidCalendarDate } from '../../lib/calendar-date'
import { getNativeAuthStorage } from '../../lib/native-auth-storage'
import { tiqSkills } from '../../lib/tiq-assessment-skills'

const coreQuestions = [
  {
    ...tiqSkills[0], prompt: 'How reliable is your serve?',
    answers: ['I’m learning to start points with a serve.', 'I can serve into both boxes at an easy pace.', 'I trust my second serve under normal match pressure.', 'I vary first-serve targets and can place a second serve under pressure.'],
  },
  {
    ...tiqSkills[1], prompt: 'What can you do against a match-speed serve?',
    answers: ['I’m learning to get returns back into play.', 'I return slower serves with a compact swing.', 'I neutralize most first serves and aim my second-serve returns.', 'I adjust my position and target to the server and the score.'],
  },
  {
    ...tiqSkills[2], prompt: 'How steady is your baseline rally?',
    answers: ['I’m learning to keep a ball in play.', 'I can sustain an easy rally from the baseline.', 'I direct forehands and backhands with margin at match pace.', 'I vary depth, pace, and direction while staying consistent under pressure.'],
  },
  {
    ...tiqSkills[3], prompt: 'How do you move between shots?',
    answers: ['I often reach for the ball or arrive late.', 'I get into position for a predictable ball.', 'I split-step and recover between most shots.', 'I recover efficiently after wide or deep balls and stay ready for the next shot.'],
  },
  {
    ...tiqSkills[4], prompt: 'How comfortable are you finishing at net?',
    answers: ['I’m learning the basic volley.', 'I can block an easy volley back in play.', 'I choose an approach and place the first volley with control.', 'I handle low and fast volleys and choose when to close or cover the lob.'],
  },
  {
    ...tiqSkills[5], prompt: 'How do you build a point when the score gets tight?',
    answers: ['I’m learning how to start and finish a point.', 'I focus on keeping the ball in play and recovering.', 'I recognize when to defend, rally, or attack.', 'I adjust my patterns to the opponent while keeping my targets under pressure.'],
  },
] as const

const singlesQuestions = [
  {
    id: 'singles-build', skill: 'Singles patterns', prompt: 'How do you create an opening in singles?',
    answers: ['I try to get each ball back.', 'I aim for open court when I see it.', 'I use depth or direction to earn a shorter ball.', 'I build a sequence of shots to exploit an opponent’s position or weaker side.'],
    drill: { id: 'crosscourt-consistency', title: 'Crosscourt Consistency' },
  },
  {
    id: 'singles-cover', skill: 'Singles court coverage', prompt: 'How do you handle being pulled wide in singles?',
    answers: ['I struggle to get to the next ball.', 'I get the ball back and try to return to the middle.', 'I use a higher or deeper reply to buy recovery time.', 'I adjust my recovery to the angles I’ve left open.'],
    drill: { id: 'split-step-rhythm', title: 'Split-Step Rhythm' },
  },
] as const

const doublesQuestions = [
  {
    id: 'doubles-coverage', skill: 'Doubles positioning', prompt: 'How do you cover the court with a doubles partner?',
    answers: ['I’m learning where to stand and whose ball it is.', 'I hold my side and call obvious balls.', 'I move with my partner and call middle balls and switches.', 'I coordinate changes in coverage as the ball and opponents move.'],
    drill: { id: 'volley-ready-split', title: 'Volley Ready Split' },
  },
  {
    id: 'doubles-patterns', skill: 'Doubles patterns', prompt: 'How do you start a doubles point?',
    answers: ['I try to put the serve or return in play.', 'I can aim crosscourt when serving or returning.', 'I choose a serve or return target that helps my partner.', 'We agree on patterns and adapt when opponents poach or change formation.'],
    drill: { id: 'doubles-return-first-move', title: 'Doubles Return First Move' },
  },
] as const

export const starterQuestionGroups = [
  { title: 'Serve, return & rally', questions: coreQuestions.slice(0, 3) },
  { title: 'Movement, net play & points', questions: coreQuestions.slice(3) },
  { title: 'Singles & doubles', questions: [...singlesQuestions, ...doublesQuestions] },
] as const

const allQuestions = [...coreQuestions, ...singlesQuestions, ...doublesQuestions]
type StarterQuestion = typeof allQuestions[number]
type Answer = 0 | 1 | 2 | 3
export type StarterAnswers = Partial<Record<StarterQuestion['id'], Answer>>
type CompleteAnswers = StarterAnswers & Record<typeof coreQuestions[number]['id'], Answer>
type LegacyAnswers = [Answer, Answer, Answer]
type StarterAssessment = { date: string; answers: CompleteAnswers }
type StarterHistory = { current: StarterAssessment; previous: StarterAssessment | null }

const levels = ['Learning the game', 'Building consistency', 'Match ready', 'Competitive'] as const
const isAnswer = (value: unknown): value is Answer => value === 0 || value === 1 || value === 2 || value === 3

function readLegacyAnswers(value: unknown): LegacyAnswers | undefined {
  if (Array.isArray(value) && value.length === 3 && value.every(isAnswer)) return [value[0], value[1], value[2]]
}

export function legacyStarterResult(answers: LegacyAnswers) {
  const [lowest, middle] = [...answers].sort((a, b) => a - b)
  const focusId = (['rally', 'serve', 'points'] as const)[answers.indexOf(lowest)]
  return {
    level: levels[middle],
    prefill: { rally: answers[0], serve: answers[1], points: answers[2] } satisfies StarterAnswers,
    drill: coreQuestions.find(question => question.id === focusId)!.drill,
  }
}

export function readStarterAnswers(value: unknown): CompleteAnswers | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const answers: StarterAnswers = {}
  for (const { id } of allQuestions) {
    const value = input[id]
    if (value === undefined) continue
    if (!isAnswer(value)) return null
    answers[id] = value
  }
  if (!coreQuestions.every(({ id }) => answers[id] !== undefined)) return null
  for (const [first, second] of [singlesQuestions, doublesQuestions]) {
    if ((answers[first.id] === undefined) !== (answers[second.id] === undefined)) return null
  }
  return answers as CompleteAnswers
}

function readAssessment(value: unknown): StarterAssessment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const { date, answers } = value as Record<string, unknown>
  const parsed = readStarterAnswers(answers)
  return typeof date === 'string' && isValidCalendarDate(date) && parsed ? { date, answers: parsed } : null
}

function decodeSaved(value: string | null): unknown {
  try { return value === null ? null : JSON.parse(value) }
  catch { return null }
}

function estimate(answers: readonly Answer[]) {
  const points = answers.reduce<number>((sum, answer) => sum + answer, 0)
  return 1 + Math.round(3 * points / answers.length)
}

export function starterResult(answers: CompleteAnswers) {
  const skills = coreQuestions.map(question => ({ ...question, value: answers[question.id] }))
  const sharedAnswers = skills.map(skill => skill.value)
  const score = estimate(sharedAnswers)
  const level = score <= 3 ? levels[0] : score <= 5 ? levels[1] : score <= 8 ? levels[2] : levels[3]
  const formatScore = (questions: readonly StarterQuestion[]) => {
    const format = questions.map(question => answers[question.id])
    return format.every(isAnswer) ? estimate([...sharedAnswers, ...format]) : null
  }
  const focus = allQuestions.reduce((lowest, question) =>
    (answers[question.id] ?? 4) < (answers[lowest.id] ?? 4) ? question : lowest)
  return { score, level, skills, focus, singles: formatScore(singlesQuestions), doubles: formatScore(doublesQuestions) }
}

export function starterStorage(owner: string) {
  const key = 'starter-tiq:v2:' + owner
  const legacyKey = 'starter-tiq:v1:' + owner
  const storage = getNativeAuthStorage() ?? localStorage
  return {
    async read() {
      const entry = decodeSaved(await storage.getItem(key)) as Partial<StarterHistory> | null
      const current = readAssessment(entry?.current)
      if (current) return { history: { current, previous: readAssessment(entry?.previous) }, legacy: undefined }
      return { history: null, legacy: readLegacyAnswers(decodeSaved(await storage.getItem(legacyKey))) }
    },
    async save(history: StarterHistory) { await storage.setItem(key, JSON.stringify(history)) },
    async clear() {
      await storage.removeItem(legacyKey)
      await storage.removeItem(key)
    },
  }
}

export async function clearStarterTiq(owner: string) {
  await starterStorage(owner).clear()
}
