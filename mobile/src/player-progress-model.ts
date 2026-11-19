import {chatTimestamp} from '../../lib/chat-timestamp'
import {assessmentContexts, type CoachAssessment} from '../../lib/native-coach-assessment-contract'
import {tiqSkills, type TiqSkillId} from '../../lib/tiq-assessment-skills'
import {localCalendarDate, shiftCalendarDay} from './calendar-data'
import {contextAssessments} from './coach-assessment-comparison'
import type {TrainingSession} from './level-up-data'
import {starterResult, type starterStorage} from './starter-tiq'
import type {TrainingCoachWork} from './training-inbox-data'

export type SelfAssessmentHistory = Awaited<ReturnType<ReturnType<typeof starterStorage>['read']>>
export type ProgressContext = keyof typeof assessmentContexts
export function playerObservations(rows: readonly CoachAssessment[], context?: ProgressContext) {
  const contexts = (Object.keys(assessmentContexts) as ProgressContext[]).filter(key => contextAssessments(rows, key).length)
    .sort((a, b) => {
      const left = chatTimestamp(contextAssessments(rows, a)[0].createdAt)!, right = chatTimestamp(contextAssessments(rows, b)[0].createdAt)!
      return left === right ? a.localeCompare(b) : left > right ? -1 : 1
    })
  const selected = context && contexts.includes(context) ? context : contexts[0]
  const records = selected ? contextAssessments(rows, selected) : []
  const latest = records[0]
  const earlier = latest ? records.find(row => chatTimestamp(row.createdAt)! < chatTimestamp(latest.createdAt)!) : undefined
  // Coach names label each observation; a display name is never used as an identity.
  const changes = latest ? tiqSkills.flatMap(({id, skill}) => {
    const before = earlier?.observation.skills[id], after = latest.observation.skills[id]
    if (before === undefined && after === undefined) return []
    return [{id, skill, before, after, direction: before === undefined ? 'first' : after === undefined ? 'unobserved'
      : after > before ? 'higher' : after < before ? 'lower' : 'same'}]
  }) : []
  return {contexts, context: selected, latest, earlier, changes}
}
export function playerPracticePriority(self: SelfAssessmentHistory | null, assessment?: CoachAssessment) {
  const skill = tiqSkills.find(row => row.id === assessment?.observation.focus)
  if (skill && assessment) return {source: 'coach' as const, skill: skill.skill, drill: skill.drill, target: skill.target, assessment}
  const result = self?.history ? starterResult(self.history.current.answers) : null
  return result ? {source: 'self' as const, skill: result.focus.skill, drill: result.focus.drill,
    target: 'target' in result.focus ? result.focus.target : 'Use the drill’s court cue and record what you can repeat.', assessment: undefined} : null
}
export function assessmentPractice(work: TrainingCoachWork | null, assessment: CoachAssessment | undefined, cardId: string) {
  if (!assessment || !work) return undefined
  return work.assignments.find(row => row.id === assessment.id && row.assignment.cardId === cardId
    && work.links.some(link => link.id === row.studentLinkId && link.status !== 'paused'))
}
export function savedPracticeWeek(rows: readonly TrainingSession[], now = new Date()) {
  const today = localCalendarDate(now), first = shiftCalendarDay(today, -6)
  const valid = rows.filter(row => Number.isFinite(Date.parse(row.completedAt)) && Date.parse(row.completedAt) <= now.getTime())
  const days = Array.from({length: 7}, (_, index) => ({date: shiftCalendarDay(first, index), count: 0}))
  let count = 0, seconds = 0
  for (const row of valid) {
    const date = localCalendarDate(new Date(row.completedAt)), day = days.find(item => item.date === date)
    if (!day) continue
    day.count++; count++; seconds += row.elapsedSeconds
  }
  return {days, count, minutes: Math.round(seconds / 60), activeDays: days.filter(day => day.count).length,
    latest: [...valid].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0]}
}
export const skillLevelChange = (before: number | undefined, after: number | undefined) => before === undefined ? 'First observation'
  : after === undefined ? 'Not observed this time' : before === after ? 'Same observed level' : after > before ? 'Higher observed level' : 'Lower observed level'
export const selfSkill = (self: SelfAssessmentHistory | null, id: TiqSkillId) => self?.history?.current.answers[id]
