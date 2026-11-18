import { coachId, coachRecord } from './native-coach-contract'
import { tiqSkills, type TiqSkillId } from './tiq-assessment-skills'

export const assessmentContexts = { lesson: 'Lesson', drill: 'On-court drill', match: 'Match play' } as const
export const assessmentNoteLimit = 600
export type SkillObservation = 0 | 1 | 2 | 3
export type SkillObservations = Partial<Record<TiqSkillId, SkillObservation>>

export type CoachObservation = {
  context: keyof typeof assessmentContexts
  skills: SkillObservations
  focus: TiqSkillId | null
  note: string
}

export type CoachAssessmentDraft = {
  id: string
  student: string
  linkUpdatedAt: string
  observation: CoachObservation
}

export type CoachAssessment = { id: string; coach: string; createdAt: string; observation: CoachObservation }

function uuid(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw Error('Invalid assessment ID')
  return value.toLowerCase()
}

function timestamp(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value)
    || !Number.isFinite(Date.parse(value))) throw Error('Invalid assessment date')
  return value
}

export function readCoachObservation(value: unknown): CoachObservation {
  const { context, skills, focus, note } = coachRecord(value)
  if (typeof context !== 'string' || !Object.hasOwn(assessmentContexts, context)
    || typeof note !== 'string' || note.length > assessmentNoteLimit) throw Error('Invalid observation')
  const rawSkills = coachRecord(skills)
  const observed: SkillObservations = {}
  for (const { id } of tiqSkills) {
    if (!Object.hasOwn(rawSkills, id)) continue
    const score = rawSkills[id]
    if (score !== 0 && score !== 1 && score !== 2 && score !== 3) throw Error('Invalid skill level')
    observed[id] = score
  }
  const count = Object.keys(observed).length
  if (!count || count !== Object.keys(rawSkills).length
    || (focus !== null && (typeof focus !== 'string' || !Object.hasOwn(observed, focus)))) throw Error('Choose observed skills')
  return { context: context as CoachObservation['context'], skills: observed, focus: focus as CoachObservation['focus'], note: note.trim() }
}

export function readCoachAssessmentDraft(value: unknown): CoachAssessmentDraft {
  const { id, student, linkUpdatedAt, observation } = coachRecord(value)
  return { id: uuid(id), student: coachId(student), linkUpdatedAt: timestamp(linkUpdatedAt), observation: readCoachObservation(observation) }
}

export function readCoachAssessments(value: unknown): CoachAssessment[] {
  if (!Array.isArray(value) || value.length > 12) throw Error('Invalid coach assessments')
  return value.map(item => {
    const { id, coach, createdAt, observation } = coachRecord(item)
    if (typeof coach !== 'string' || !coach.trim() || coach.length > 100) throw Error('Invalid coach name')
    return { id: uuid(id), coach, createdAt: timestamp(createdAt), observation: readCoachObservation(observation) }
  })
}
